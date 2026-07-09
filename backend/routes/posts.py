from flask import Blueprint, request, jsonify, g
from models import Post, PostVote, Community, CommunityMember, User, db
from database import get_mongo
from storage import upload_image
from auth_utils import require_auth, forbid_unless_owner, forbid_unless_owner_or_moderator
from errors import err
from notifications import notify, notify_many
from datetime import datetime, timezone

posts_bp = Blueprint("posts", __name__)


def _enrich(post, user_id=None):
    """post.to_dict() + author, community, comment_count y el voto del usuario actual."""
    d = post.to_dict()
    author = User.query.get(post.author_id) if post.author_id else None
    community = Community.query.get(post.community_id) if post.community_id else None
    d["author"] = author.to_dict() if author else None
    d["community"] = community.to_dict() if community else None
    mongo = get_mongo()
    try:
        d["comment_count"] = mongo.comments.count_documents(
            {"post_id": post.id, "deleted_at": None, "status": "active"}) if mongo is not None else 0
    except Exception:
        d["comment_count"] = 0
    # Voto del usuario actual (1, -1 o 0) para resaltar su elección tras recargar.
    d["user_vote"] = 0
    if user_id:
        v = PostVote.query.filter_by(post_id=post.id, user_id=user_id).first()
        d["user_vote"] = v.vote_type if v else 0
    return d


# global feed: publicaciones más recientes de todas las comunidades
@posts_bp.route("/posts", methods=["GET"])
def feed():
    limit = min(int(request.args.get("limit", 20)), 100)
    offset = int(request.args.get("offset", 0))
    user_id = request.args.get("user_id", type=int)
    q = (Post.query
         .filter_by(deleted_at=None, status="active")
         .order_by(Post.created_at.desc()))
    total = q.count()
    posts = q.offset(offset).limit(limit).all()
    return jsonify({
        "data": [_enrich(p, user_id) for p in posts],
        "total": total, "limit": limit, "offset": offset,
        "has_more": offset + len(posts) < total,
    })


# list posts of a community
@posts_bp.route("/communities/<int:community_id>/posts", methods=["GET"])
def get_posts(community_id):
    community = Community.query.filter_by(id=community_id, deleted_at=None).first()
    if not community:
        return err("NOT_FOUND", "Comunidad no encontrada", 404)

    user_id = request.args.get("user_id", type=int)
    posts = (
        Post.query
        .filter_by(community_id=community_id, deleted_at=None, status="active")
        .order_by(Post.created_at.desc())
        .all()
    )
    return jsonify({"posts": [_enrich(p, user_id) for p in posts]})


# get a post by ID
@posts_bp.route("/posts/<int:post_id>", methods=["GET"])
def get_post(post_id):
    post = Post.query.filter_by(id=post_id, deleted_at=None).first()
    if not post:
        return err("NOT_FOUND", "Post no encontrado", 404)
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
    member_ids = [
        uid for (uid,) in db.session.query(CommunityMember.user_id)
        .filter_by(community_id=community.id, status="active").all()
    ]
    notify_many(member_ids, "COMMUNITY_POST", g.current_user.id, post_id=post.id)

    return jsonify({"message": "Post creado", "post": post.to_dict()}), 201


# update post
@posts_bp.route("/posts/<int:post_id>", methods=["PUT"])
@require_auth
def update_post(post_id):
    post = Post.query.filter_by(id=post_id, deleted_at=None).first()
    if not post:
        return err("NOT_FOUND", "Post no encontrado", 404)
    if (resp := forbid_unless_owner(post.author_id)):
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
