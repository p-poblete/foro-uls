from flask import Blueprint, request, jsonify
from models import Post, PostVote, Community, User, db
from datetime import datetime, timezone

posts_bp = Blueprint("posts", __name__)


# list posts of a community
@posts_bp.route("/communities/<int:community_id>/posts", methods=["GET"])
def get_posts(community_id):
    community = Community.query.filter_by(id=community_id, deleted_at=None).first()
    if not community:
        return jsonify({"error": "Comunidad no encontrada"}), 404

    posts = (
        Post.query
        .filter_by(community_id=community_id, deleted_at=None, status="active")
        .order_by(Post.created_at.desc())
        .all()
    )
    return jsonify({"posts": [p.to_dict() for p in posts]})


# get a post by ID
@posts_bp.route("/posts/<int:post_id>", methods=["GET"])
def get_post(post_id):
    post = Post.query.filter_by(id=post_id, deleted_at=None).first()
    if not post:
        return jsonify({"error": "Post no encontrado"}), 404
    return jsonify({"post": post.to_dict()})


# create a new post
@posts_bp.route("/posts", methods=["POST"])
def create_post():
    data = request.get_json()
    if not data or not data.get("community_id") or not data.get("author_id") or not data.get("title"):
        return jsonify({"error": "community_id, author_id y title son obligatorios"}), 400

    community = Community.query.filter_by(id=data["community_id"], deleted_at=None).first()
    if not community:
        return jsonify({"error": "Comunidad no encontrada"}), 404

    author = User.query.filter_by(id=data["author_id"], deleted_at=None).first()
    if not author:
        return jsonify({"error": "Usuario autor no encontrado"}), 404

    post = Post(
        community_id=data["community_id"],
        author_id=data["author_id"],
        title=data["title"],
        content=data.get("content"),
        post_type=data.get("post_type", "text"),
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
    if "status" in data:
        post.status = data["status"]

    db.session.commit()
    return jsonify({"message": "Post actualizado", "post": post.to_dict()})


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

    existing = PostVote.query.filter_by(post_id=post_id, user_id=data["user_id"]).first()
    if existing:
        # Change existing vote
        post.vote_score += data["vote_type"] - existing.vote_type
        existing.vote_type = data["vote_type"]
    else:
        # New vote
        vote = PostVote(post_id=post_id, user_id=data["user_id"], vote_type=data["vote_type"])
        db.session.add(vote)
        post.vote_score += data["vote_type"]

    db.session.commit()
    return jsonify({"message": "Voto registrado", "vote_score": post.vote_score})
