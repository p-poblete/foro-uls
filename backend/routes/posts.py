from flask import Blueprint, request, jsonify, g
from sqlalchemy import or_
from models import Post, PostVote, Community, CommunityMember, User, db
from database import get_mongo
from storage import upload_image
from auth_utils import (
    require_auth, forbid_unless_owner, forbid_unless_owner_or_moderator,
    can_view_community, current_user, is_moderator,
)
from errors import err
from notifications import notify, notify_many
from datetime import datetime, timezone

posts_bp = Blueprint("posts", __name__)


def _enrich_many(posts, user_id=None):
    """Enriquece una página de posts en LOTE: 3 consultas SQL + 1 agregación
    Mongo en total, sin importar el tamaño de la página. (Antes: 4 consultas
    POR post — con 100 posts eran ~100 viajes de red a Atlas por request.)"""
    if not posts:
        return []
    post_ids      = [p.id for p in posts]
    author_ids    = {p.author_id for p in posts if p.author_id}
    community_ids = {p.community_id for p in posts if p.community_id}

    authors = {u.id: u.to_dict() for u in User.query.filter(User.id.in_(author_ids)).all()} if author_ids else {}
    communities = {c.id: c.to_dict() for c in Community.query.filter(Community.id.in_(community_ids)).all()} if community_ids else {}

    # Conteo de comentarios: una sola agregación para toda la página.
    comment_counts = {}
    try:
        mongo = get_mongo()
        if mongo is not None:
            for row in mongo.comments.aggregate([
                {"$match": {"post_id": {"$in": post_ids}, "deleted_at": None, "status": "active"}},
                {"$group": {"_id": "$post_id", "n": {"$sum": 1}}},
            ]):
                comment_counts[row["_id"]] = row["n"]
    except Exception:
        pass

    # Votos del usuario actual: una sola consulta para toda la página.
    votes = {}
    if user_id:
        votes = {
            v.post_id: v.vote_type
            for v in PostVote.query.filter(
                PostVote.user_id == user_id, PostVote.post_id.in_(post_ids)).all()
        }

    out = []
    for p in posts:
        d = p.to_dict()
        d["author"] = authors.get(p.author_id)
        d["community"] = communities.get(p.community_id)
        d["comment_count"] = comment_counts.get(p.id, 0)
        d["user_vote"] = votes.get(p.id, 0)
        out.append(d)
    return out


def _enrich(post, user_id=None):
    """Versión de un solo post (detalle)."""
    return _enrich_many([post], user_id)[0]


# global feed: publicaciones más recientes de todas las comunidades.
# Paginación por cursor (recomendada): ?cursor=<id del último post recibido>
# devuelve los `limit` posts siguientes. El id SERIAL crece con created_at, así
# que `id < cursor` + índice = búsqueda O(log n) sin escanear filas saltadas
# (a diferencia de offset). Se mantiene ?offset= por compatibilidad.
@posts_bp.route("/posts", methods=["GET"])
def feed():
    limit = min(int(request.args.get("limit", 20)), 100)
    cursor = request.args.get("cursor", type=int)
    offset = int(request.args.get("offset", 0))
    user_id = request.args.get("user_id", type=int)

    q = (Post.query
         .join(Community, Post.community_id == Community.id)
         .filter(Post.deleted_at.is_(None), Post.status == "active",
                 Community.deleted_at.is_(None))
         .order_by(Post.id.desc()))

    # Privacidad: las comunidades privadas no aparecen en el feed global salvo
    # para sus miembros y para moderadores (que supervisan todo).
    if not is_moderator():
        viewer = current_user()
        if viewer:
            member_sq = (db.session.query(CommunityMember.community_id)
                         .filter_by(user_id=viewer.id, status="active"))
            q = q.filter(or_(Community.visibility != "private",
                             Community.id.in_(member_sq)))
        else:
            q = q.filter(Community.visibility != "private")
    if cursor:
        q = q.filter(Post.id < cursor)
        posts = q.limit(limit + 1).all()          # +1 para saber si hay más
        has_more = len(posts) > limit
        posts = posts[:limit]
        return jsonify({
            "data": _enrich_many(posts, user_id),
            "limit": limit,
            "has_more": has_more,
            "next_cursor": posts[-1].id if posts and has_more else None,
        })

    # Primera página (o modo offset legado).
    total = q.count()
    posts = q.offset(offset).limit(limit).all()
    has_more = offset + len(posts) < total
    return jsonify({
        "data": _enrich_many(posts, user_id),
        "total": total, "limit": limit, "offset": offset,
        "has_more": has_more,
        "next_cursor": posts[-1].id if posts and has_more else None,
    })


# list posts of a community
@posts_bp.route("/communities/<int:community_id>/posts", methods=["GET"])
def get_posts(community_id):
    community = Community.query.filter_by(id=community_id, deleted_at=None).first()
    if not community:
        return err("NOT_FOUND", "Comunidad no encontrada", 404)
    if not can_view_community(community):
        return err("FORBIDDEN", "Esta comunidad es privada: su contenido es solo para miembros", 403)

    user_id = request.args.get("user_id", type=int)
    posts = (
        Post.query
        .filter_by(community_id=community_id, deleted_at=None, status="active")
        .order_by(Post.created_at.desc())
        .all()
    )
    return jsonify({"posts": _enrich_many(posts, user_id)})


# get a post by ID
@posts_bp.route("/posts/<int:post_id>", methods=["GET"])
def get_post(post_id):
    post = Post.query.filter_by(id=post_id, deleted_at=None).first()
    if not post:
        return err("NOT_FOUND", "Post no encontrado", 404)
    community = Community.query.filter_by(id=post.community_id).first()
    if not can_view_community(community):
        return err("FORBIDDEN", "Esta publicación pertenece a una comunidad privada", 403)
    user_id = request.args.get("user_id", type=int)
    return jsonify({"post": _enrich(post, user_id)})


# create a new post
@posts_bp.route("/posts", methods=["POST"])
@require_auth
def create_post():
    data = request.get_json(silent=True) if request.is_json else request.form.to_dict()
    file = request.files.get("image")

    if not data or not data.get("community_id") or not data.get("title"):
        return err("VALIDATION_ERROR", "community_id y title son obligatorios", 400)

    community = Community.query.filter_by(id=data["community_id"], deleted_at=None).first()
    if not community:
        return err("NOT_FOUND", "Comunidad no encontrada", 404)

    # La imagen puede venir como archivo multipart o como URL ya subida (/api/uploads).
    image_url = data.get("image_url")
    if file:
        url, error = upload_image(file, prefix="posts")
        if error:
            return err("STORAGE_ERROR", error, 400)
        image_url = url

    post = Post(
        community_id=data["community_id"],
        author_id=g.current_user.id,  # ownership: el autor es el usuario autenticado
        title=data["title"],
        content=data.get("content"),
        label=data.get("label"),
        external_link=data.get("external_link"),
        post_type=data.get("post_type", "image" if image_url else "text"),
        image_url=image_url
    )
    db.session.add(post)
    db.session.commit()

    # Notifica a los miembros activos de la comunidad (best-effort, en Mongo).
    # Los anuncios llevan tipo propio para distinguirse en la campana.
    member_ids = [
        uid for (uid,) in db.session.query(CommunityMember.user_id)
        .filter_by(community_id=community.id, status="active").all()
    ]
    ntype = "ANNOUNCEMENT" if post.label == "ANNOUNCEMENT" else "COMMUNITY_POST"
    notify_many(member_ids, ntype, g.current_user.id, post_id=post.id)

    return jsonify({"message": "Post creado", "post": post.to_dict()}), 201


# update post — autor, o moderador (con aviso al autor)
@posts_bp.route("/posts/<int:post_id>", methods=["PUT"])
@require_auth
def update_post(post_id):
    post = Post.query.filter_by(id=post_id, deleted_at=None).first()
    if not post:
        return err("NOT_FOUND", "Post no encontrado", 404)
    if (resp := forbid_unless_owner_or_moderator(post.author_id)):
        return resp

    data = request.get_json() or {}
    if "title" in data:
        post.title = data["title"]
    if "content" in data:
        post.content = data["content"]
    if "label" in data:
        post.label = data["label"]
    if "external_link" in data:
        post.external_link = data["external_link"]
    if "image_url" in data:
        post.image_url = data["image_url"]
    if "status" in data:
        post.status = data["status"]

    db.session.commit()

    # Si edita un moderador que no es el autor, se avisa al autor (anónimo).
    if post.author_id and g.current_user.id != post.author_id:
        notify(post.author_id, "CONTENT_EDITED", post_id=post.id,
               message="Un moderador editó tu publicación por incumplir las normas.")

    return jsonify({"message": "Post actualizado", "post": _enrich(post)})


# delete post (soft delete) — autor o moderador
@posts_bp.route("/posts/<int:post_id>", methods=["DELETE"])
@require_auth
def delete_post(post_id):
    post = Post.query.filter_by(id=post_id, deleted_at=None).first()
    if not post:
        return err("NOT_FOUND", "Post no encontrado", 404)
    if (resp := forbid_unless_owner_or_moderator(post.author_id)):
        return resp

    post.deleted_at = datetime.now(timezone.utc)
    post.status = "removed"
    db.session.commit()
    return "", 204


# vote a post
@posts_bp.route("/posts/<int:post_id>/vote", methods=["POST"])
@require_auth
def vote_post(post_id):
    data = request.get_json() or {}
    if "vote_type" not in data:
        return err("VALIDATION_ERROR", "vote_type (1 o -1) es obligatorio", 400)
    if data["vote_type"] not in (1, -1):
        return err("VALIDATION_ERROR", "vote_type debe ser 1 (upvote) o -1 (downvote)", 400)

    post = Post.query.filter_by(id=post_id, deleted_at=None).first()
    if not post:
        return err("NOT_FOUND", "Post no encontrado", 404)

    user_id = g.current_user.id  # el votante es el usuario autenticado
    vote_type = data["vote_type"]
    # La constraint única (post_id, user_id) garantiza un solo voto por usuario.
    existing = PostVote.query.filter_by(post_id=post_id, user_id=user_id).first()
    if existing:
        if existing.vote_type == vote_type:
            # Mismo voto → lo quita (toggle off).
            post.vote_score -= existing.vote_type
            db.session.delete(existing)
            user_vote = 0
        else:
            # Cambia el sentido del voto.
            post.vote_score += vote_type - existing.vote_type
            existing.vote_type = vote_type
            user_vote = vote_type
    else:
        db.session.add(PostVote(post_id=post_id, user_id=user_id, vote_type=vote_type))
        post.vote_score += vote_type
        user_vote = vote_type
        # Notifica al autor solo en votos nuevos (no toggles ni cambios de sentido).
        if post.author_id:
            notify(post.author_id, "LIKE" if vote_type == 1 else "DISLIKE",
                   user_id, post_id=post.id)

    db.session.commit()
    return jsonify({"vote_score": post.vote_score, "user_vote": user_vote})
