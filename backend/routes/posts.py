from flask import Blueprint, request, jsonify
from models import Post, PostVote, Community, User, db
from database import get_mongo
from storage import upload_image
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
        return jsonify({"error": "Comunidad no encontrada"}), 404

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
        return jsonify({"error": "Post no encontrado"}), 404
    user_id = request.args.get("user_id", type=int)
    return jsonify({"post": _enrich(post, user_id)})


# create a new post
@posts_bp.route("/posts", methods=["POST"])
def create_post():
    data = request.get_json(silent=True) if request.is_json else request.form.to_dict()
    file = request.files.get("image")

    if not data or not data.get("community_id") or not data.get("author_id") or not data.get("title"):
        return jsonify({"error": "community_id, author_id y title son obligatorios"}), 400

    community = Community.query.filter_by(id=data["community_id"], deleted_at=None).first()
    if not community:
        return jsonify({"error": "Comunidad no encontrada"}), 404

    author = User.query.filter_by(id=data["author_id"], deleted_at=None).first()
    if not author:
        return jsonify({"error": "Usuario autor no encontrado"}), 404

    # La imagen puede venir como archivo multipart o como URL ya subida (/api/uploads).
    image_url = data.get("image_url")
    if file:
        url, error = upload_image(file, prefix="posts")
        if error:
            return jsonify({"error": error}), 400
        image_url = url

    post = Post(
        community_id=data["community_id"],
        author_id=data["author_id"],
        title=data["title"],
        content=data.get("content"),
        label=data.get("label"),
        external_link=data.get("external_link"),
        post_type=data.get("post_type", "image" if image_url else "text"),
        image_url=image_url
    )
    db.session.add(post)
    db.session.commit()
    return jsonify({"message": "Post creado", "post": post.to_dict()}), 201


# update post
@posts_bp.route("/posts/<int:post_id>", methods=["PUT"])
def update_post(post_id):
    post = Post.query.filter_by(id=post_id, deleted_at=None).first()
    if not post:
        return jsonify({"error": "Post no encontrado"}), 404

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


# delete post (soft delete)
@posts_bp.route("/posts/<int:post_id>", methods=["DELETE"])
def delete_post(post_id):
    post = Post.query.filter_by(id=post_id, deleted_at=None).first()
    if not post:
        return jsonify({"error": "Post no encontrado"}), 404

    post.deleted_at = datetime.now(timezone.utc)
    post.status = "removed"
    db.session.commit()
    return jsonify({"message": "Post eliminado", "post": post.to_dict()})


# vote a post 
@posts_bp.route("/posts/<int:post_id>/vote", methods=["POST"])
def vote_post(post_id):
    data = request.get_json()
    if not data or "user_id" not in data or "vote_type" not in data:
        return jsonify({"error": "user_id y vote_type (1 o -1) son obligatorios"}), 400
    if data["vote_type"] not in (1, -1):
        return jsonify({"error": "vote_type debe ser 1 (upvote) o -1 (downvote)"}), 400

    post = Post.query.filter_by(id=post_id, deleted_at=None).first()
    if not post:
        return jsonify({"error": "Post no encontrado"}), 404

    user = User.query.filter_by(id=data["user_id"], deleted_at=None).first()
    if not user:
        return jsonify({"error": "Usuario no encontrado"}), 404

    vote_type = data["vote_type"]
    # La constraint única (post_id, user_id) garantiza un solo voto por usuario.
    existing = PostVote.query.filter_by(post_id=post_id, user_id=data["user_id"]).first()
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
        db.session.add(PostVote(post_id=post_id, user_id=data["user_id"], vote_type=vote_type))
        post.vote_score += vote_type
        user_vote = vote_type

    db.session.commit()
    return jsonify({"vote_score": post.vote_score, "user_vote": user_vote})
