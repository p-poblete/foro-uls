import re
from flask import Blueprint, request, jsonify, g
from sqlalchemy import func
from models import Community, CommunityMember, User, db
from auth_utils import require_auth, current_user, forbid_unless_owner, forbid_unless_owner_or_moderator
from errors import err
from datetime import datetime, timezone

communities_bp = Blueprint("communities", __name__)


def slugify(text):
    """Convierte un texto en slug URL-friendly."""
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def _member_counts(community_ids):
    """{community_id: n_miembros_activos} en una sola consulta (evita N+1)."""
    if not community_ids:
        return {}
    rows = (
        db.session.query(CommunityMember.community_id, func.count(CommunityMember.id))
        .filter(CommunityMember.community_id.in_(community_ids),
                CommunityMember.status == "active")
        .group_by(CommunityMember.community_id)
        .all()
    )
    return dict(rows)


def _with_membership(c_dict, counts, user):
    """Añade member_count real y el estado de membresía del usuario actual."""
    c_dict["member_count"] = counts.get(c_dict["id"], 0)
    c_dict["membership"] = None
    if user:
        m = CommunityMember.query.filter_by(
            community_id=c_dict["id"], user_id=user.id).first()
        c_dict["membership"] = m.status if m else None
    return c_dict


# list all communities
@communities_bp.route("/communities", methods=["GET"])
def get_communities():
    communities = Community.query.filter_by(deleted_at=None).all()
    counts = _member_counts([c.id for c in communities])
    user = current_user()  # opcional: enriquece con la membresía si hay token
    return jsonify({"communities": [_with_membership(c.to_dict(), counts, user) for c in communities]})


# get a community by ID
@communities_bp.route("/communities/<int:community_id>", methods=["GET"])
def get_community(community_id):
    community = Community.query.filter_by(id=community_id, deleted_at=None).first()
    if not community:
        return err("NOT_FOUND", "Comunidad no encontrada", 404)
    counts = _member_counts([community.id])
    return jsonify({"community": _with_membership(community.to_dict(), counts, current_user())})


# create a new community (el creador queda como owner y primer miembro)
@communities_bp.route("/communities", methods=["POST"])
@require_auth
def create_community():
    data = request.get_json() or {}
    if not data.get("name"):
        return err("VALIDATION_ERROR", "name es obligatorio", 400)

    visibility = data.get("visibility", "public")
    if visibility not in ("public", "restricted", "private"):
        return err("VALIDATION_ERROR", "visibility debe ser public, restricted o private", 400)

    slug = data.get("slug") or slugify(data["name"])

    if Community.query.filter_by(name=data["name"]).first():
        return err("CONFLICT", "El nombre de comunidad ya existe", 409)
    if Community.query.filter_by(slug=slug).first():
        return err("CONFLICT", "El slug ya existe, usa otro nombre", 409)

    community = Community(
        name=data["name"],
        slug=slug,
        description=data.get("description"),
        owner_id=g.current_user.id,  # ownership: el creador es el dueño
        visibility=visibility,
    )
    db.session.add(community)
    db.session.flush()  # asigna community.id antes del commit
    db.session.add(CommunityMember(
        community_id=community.id, user_id=g.current_user.id,
        role="owner", status="active",
    ))
    db.session.commit()
    return jsonify({"message": "Comunidad creada", "community": community.to_dict()}), 201


# update community
@communities_bp.route("/communities/<int:community_id>", methods=["PUT"])
@require_auth
def update_community(community_id):
    community = Community.query.filter_by(id=community_id, deleted_at=None).first()
    if not community:
        return err("NOT_FOUND", "Comunidad no encontrada", 404)
    if (resp := forbid_unless_owner_or_moderator(community.owner_id)):
        return resp

    data = request.get_json() or {}
    if "visibility" in data and data["visibility"] not in ("public", "restricted", "private"):
        return err("VALIDATION_ERROR", "visibility debe ser public, restricted o private", 400)
    if "description" in data:
        community.description = data["description"]
    if "visibility" in data:
        community.visibility = data["visibility"]
    if "status" in data:
        community.status = data["status"]
    if "image_url" in data:
        community.image_url = data["image_url"]
    if "banner_url" in data:
        community.banner_url = data["banner_url"]

    db.session.commit()
    return jsonify({"message": "Comunidad actualizada", "community": community.to_dict()})


# delete community (soft delete) — dueño o moderador
@communities_bp.route("/communities/<int:community_id>", methods=["DELETE"])
@require_auth
def delete_community(community_id):
    community = Community.query.filter_by(id=community_id, deleted_at=None).first()
    if not community:
        return err("NOT_FOUND", "Comunidad no encontrada", 404)
    if (resp := forbid_unless_owner_or_moderator(community.owner_id)):
        return resp

    community.deleted_at = datetime.now(timezone.utc)
    community.status = "archived"
    db.session.commit()
    return "", 204


# ---------- membresía ----------

# unirse: public → activo; restricted → pendiente de aprobación; private → 403
@communities_bp.route("/communities/<int:community_id>/join", methods=["POST"])
@require_auth
def join_community(community_id):
    community = Community.query.filter_by(id=community_id, deleted_at=None).first()
    if not community:
        return err("NOT_FOUND", "Comunidad no encontrada", 404)
    if community.visibility == "private":
        return err("FORBIDDEN", "Esta comunidad es privada (solo por invitación)", 403)

    existing = CommunityMember.query.filter_by(
        community_id=community_id, user_id=g.current_user.id).first()
    if existing:
        # Idempotente: repetir el join devuelve el estado actual.
        return jsonify({"message": "Ya tienes membresía", "membership": existing.to_dict()})

    status = "active" if community.visibility == "public" else "pending"
    member = CommunityMember(community_id=community_id, user_id=g.current_user.id, status=status)
    db.session.add(member)
    db.session.commit()
    msg = "Te uniste a la comunidad" if status == "active" else "Solicitud enviada, pendiente de aprobación"
    return jsonify({"message": msg, "membership": member.to_dict()}), 201


# salir de la comunidad (el owner no puede salir: transferiría o archiva)
@communities_bp.route("/communities/<int:community_id>/leave", methods=["POST"])
@require_auth
def leave_community(community_id):
    member = CommunityMember.query.filter_by(
        community_id=community_id, user_id=g.current_user.id).first()
    if not member:
        return err("NOT_FOUND", "No eres miembro de esta comunidad", 404)
    if member.role == "owner":
        return err("VALIDATION_ERROR", "El dueño no puede salir de su comunidad (archívala en su lugar)", 400)
    db.session.delete(member)
    db.session.commit()
    return "", 204


# lista de miembros (los pendientes solo los ve el dueño)
@communities_bp.route("/communities/<int:community_id>/members", methods=["GET"])
def get_members(community_id):
    community = Community.query.filter_by(id=community_id, deleted_at=None).first()
    if not community:
        return err("NOT_FOUND", "Comunidad no encontrada", 404)

    user = current_user()
    is_owner = user is not None and user.id == community.owner_id

    q = (
        db.session.query(CommunityMember, User)
        .join(User, User.id == CommunityMember.user_id)
        .filter(CommunityMember.community_id == community_id, User.deleted_at.is_(None))
    )
    if not is_owner:
        q = q.filter(CommunityMember.status == "active")

    members = [
        {**m.to_dict(), "user": u.to_dict()}
        for m, u in q.order_by(CommunityMember.joined_at.asc()).all()
    ]
    return jsonify({"members": members})


# aprobar (status=active) o gestionar la membresía de otro usuario — solo el dueño
@communities_bp.route("/communities/<int:community_id>/members/<int:user_id>", methods=["PATCH"])
@require_auth
def update_member(community_id, user_id):
    community = Community.query.filter_by(id=community_id, deleted_at=None).first()
    if not community:
        return err("NOT_FOUND", "Comunidad no encontrada", 404)
    if (resp := forbid_unless_owner(community.owner_id)):
        return resp

    member = CommunityMember.query.filter_by(community_id=community_id, user_id=user_id).first()
    if not member:
        return err("NOT_FOUND", "Membresía no encontrada", 404)

    data = request.get_json() or {}
    if data.get("status") not in ("active", "pending"):
        return err("VALIDATION_ERROR", "status debe ser active o pending", 400)
    member.status = data["status"]
    db.session.commit()
    return jsonify({"message": "Membresía actualizada", "membership": member.to_dict()})


# expulsar/rechazar a un miembro — el dueño; o el propio usuario cancela su solicitud
@communities_bp.route("/communities/<int:community_id>/members/<int:user_id>", methods=["DELETE"])
@require_auth
def remove_member(community_id, user_id):
    community = Community.query.filter_by(id=community_id, deleted_at=None).first()
    if not community:
        return err("NOT_FOUND", "Comunidad no encontrada", 404)
    if g.current_user.id != user_id and (resp := forbid_unless_owner(community.owner_id)):
        return resp

    member = CommunityMember.query.filter_by(community_id=community_id, user_id=user_id).first()
    if not member:
        return err("NOT_FOUND", "Membresía no encontrada", 404)
    if member.role == "owner":
        return err("VALIDATION_ERROR", "No se puede quitar al dueño de su comunidad", 400)
    db.session.delete(member)
    db.session.commit()
    return "", 204
