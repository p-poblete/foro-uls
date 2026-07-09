import re
from flask import Blueprint, request, jsonify, g
from models import Community, db
from auth_utils import require_auth, forbid_unless_owner
from datetime import datetime, timezone

communities_bp = Blueprint("communities", __name__)


def slugify(text):
    """Convierte un texto en slug URL-friendly."""
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


# list all communities
@communities_bp.route("/communities", methods=["GET"])
def get_communities():
    communities = Community.query.filter_by(deleted_at=None).all()
    return jsonify({"communities": [c.to_dict() for c in communities]})


# get a community by ID
@communities_bp.route("/communities/<int:community_id>", methods=["GET"])
def get_community(community_id):
    community = Community.query.filter_by(id=community_id, deleted_at=None).first()
    if not community:
        return jsonify({"error": "Comunidad no encontrada"}), 404
    return jsonify({"community": community.to_dict()})


# create a new community
@communities_bp.route("/communities", methods=["POST"])
@require_auth
def create_community():
    data = request.get_json() or {}
    if not data.get("name"):
        return jsonify({"error": "name es obligatorio"}), 400

    slug = data.get("slug") or slugify(data["name"])

    if Community.query.filter_by(name=data["name"]).first():
        return jsonify({"error": "El nombre de comunidad ya existe"}), 409
    if Community.query.filter_by(slug=slug).first():
        return jsonify({"error": "El slug ya existe, usa otro nombre"}), 409

    community = Community(
        name=data["name"],
        slug=slug,
        description=data.get("description"),
        owner_id=g.current_user.id,  # ownership: el creador es el dueño
        visibility=data.get("visibility", "public"),
    )
    db.session.add(community)
    db.session.commit()
    return jsonify({"message": "Comunidad creada", "community": community.to_dict()}), 201


# update community
@communities_bp.route("/communities/<int:community_id>", methods=["PUT"])
@require_auth
def update_community(community_id):
    community = Community.query.filter_by(id=community_id, deleted_at=None).first()
    if not community:
        return jsonify({"error": "Comunidad no encontrada"}), 404
    if (resp := forbid_unless_owner(community.owner_id)):
        return resp

    data = request.get_json() or {}
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


# delete community (soft delete)
@communities_bp.route("/communities/<int:community_id>", methods=["DELETE"])
@require_auth
def delete_community(community_id):
    community = Community.query.filter_by(id=community_id, deleted_at=None).first()
    if not community:
        return jsonify({"error": "Comunidad no encontrada"}), 404
    if (resp := forbid_unless_owner(community.owner_id)):
        return resp

    community.deleted_at = datetime.now(timezone.utc)
    community.status = "archived"
    db.session.commit()
    return jsonify({"message": "Comunidad eliminada", "community": community.to_dict()})
