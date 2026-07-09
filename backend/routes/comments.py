from flask import Blueprint, request, jsonify, g
from database import get_mongo
from models import Post
from auth_utils import require_auth, forbid_unless_owner, forbid_unless_owner_or_moderator
from errors import err
from notifications import notify
from bson import ObjectId
from bson.errors import InvalidId
from datetime import datetime, timezone

comments_bp = Blueprint("comments", __name__)


def _serialize(comment):
    """Convierte un documento MongoDB a dict JSON-serializable."""
    comment["_id"] = str(comment["_id"])
    if comment.get("parent_id"):
        comment["parent_id"] = str(comment["parent_id"])
    if isinstance(comment.get("created_at"), datetime):
        comment["created_at"] = comment["created_at"].isoformat()
    if isinstance(comment.get("updated_at"), datetime):
        comment["updated_at"] = comment["updated_at"].isoformat()
    return comment


def _parse_oid(value):
    """Intenta convertir string a ObjectId, retorna None si es inválido."""
    try:
        return ObjectId(value)
    except (InvalidId, TypeError):
        return None


# list root comments of a post
@comments_bp.route("/posts/<int:post_id>/comments", methods=["GET"])
def get_comments(post_id):
    mongo = get_mongo()
    parent_id_param = request.args.get("parent_id")

    query = {"post_id": post_id, "deleted_at": None, "status": "active"}

    if parent_id_param == "root":
        query["parent_id"] = None  # solo comentarios raíz
    elif parent_id_param:
        oid = _parse_oid(parent_id_param)
        if not oid:
            return err("VALIDATION_ERROR", "parent_id inválido", 400)
        query["parent_id"] = oid
    # sin parent_id → todos los comentarios del post (el frontend arma el árbol)

    comments = list(mongo.comments.find(query).sort("created_at", 1))
    return jsonify({"comments": [_serialize(c) for c in comments]})


# list comments authored by a user (para su perfil)
@comments_bp.route("/users/<int:user_id>/comments", methods=["GET"])
def get_user_comments(user_id):
    mongo = get_mongo()
    comments = list(
        mongo.comments
        .find({"author_id": user_id, "deleted_at": None, "status": "active"})
        .sort("created_at", -1)
    )
    return jsonify({"comments": [_serialize(c) for c in comments]})


# get a comment by ID
@comments_bp.route("/comments/<string:comment_id>", methods=["GET"])
def get_comment(comment_id):
    oid = _parse_oid(comment_id)
    if not oid:
        return err("VALIDATION_ERROR", "ID de comentario inválido", 400)

    mongo = get_mongo()
    comment = mongo.comments.find_one({"_id": oid, "deleted_at": None})
    if not comment:
        return err("NOT_FOUND", "Comentario no encontrado", 404)

    return jsonify({"comment": _serialize(comment)})


# create a new comment (root or reply)
@comments_bp.route("/posts/<int:post_id>/comments", methods=["POST"])
@require_auth
def create_comment(post_id):
    data = request.get_json() or {}
    if not data.get("content"):
        return err("VALIDATION_ERROR", "content es obligatorio", 400)

    mongo = get_mongo()
    parent_id = None
    depth = 0

    if data.get("parent_id"):
        parent_oid = _parse_oid(data["parent_id"])
        if not parent_oid:
            return err("VALIDATION_ERROR", "parent_id inválido", 400)
        parent = mongo.comments.find_one({"_id": parent_oid, "deleted_at": None})
        if not parent:
            return err("NOT_FOUND", "Comentario padre no encontrado", 404)
        parent_id = parent_oid
        depth = parent.get("depth", 0) + 1

    now = datetime.now(timezone.utc)
    comment = {
        "post_id":    post_id,
        "author_id":  g.current_user.id,  # ownership: autor = usuario autenticado
        "parent_id":  parent_id,
        "depth":      depth,
        "content":    data["content"],
        "image_url":  data.get("image_url"),
        "vote_score": 0,
        "status":     "active",
        "created_at": now,
        "updated_at": now,
        "deleted_at": None,
    }

    result = mongo.comments.insert_one(comment)
    comment["_id"]       = str(result.inserted_id)
    comment["parent_id"] = str(parent_id) if parent_id else None
    comment["created_at"] = now.isoformat()
    comment["updated_at"] = now.isoformat()

    # Notifica al autor del post (best-effort).
    post = Post.query.filter_by(id=post_id, deleted_at=None).first()
    if post and post.author_id:
        notify(post.author_id, "COMMENT", g.current_user.id,
               post_id=post_id, comment_id=comment["_id"])

    return jsonify({"message": "Comentario creado", "comment": comment}), 201


# update comment
@comments_bp.route("/comments/<string:comment_id>", methods=["PUT"])
@require_auth
def update_comment(comment_id):
    oid = _parse_oid(comment_id)
    if not oid:
        return err("VALIDATION_ERROR", "ID de comentario inválido", 400)

    data = request.get_json()
    if not data or not data.get("content"):
        return err("VALIDATION_ERROR", "content es obligatorio", 400)

    mongo = get_mongo()
    comment = mongo.comments.find_one({"_id": oid, "deleted_at": None})
    if not comment:
        return err("NOT_FOUND", "Comentario no encontrado", 404)
    if (resp := forbid_unless_owner(comment.get("author_id"))):
        return resp

    mongo.comments.update_one(
        {"_id": oid},
        {"$set": {"content": data["content"], "updated_at": datetime.now(timezone.utc)}}
    )
    comment["content"] = data["content"]
    return jsonify({"message": "Comentario actualizado", "comment": _serialize(comment)})


# delete comment (soft delete) — autor o moderador
@comments_bp.route("/comments/<string:comment_id>", methods=["DELETE"])
@require_auth
def delete_comment(comment_id):
    oid = _parse_oid(comment_id)
    if not oid:
        return err("VALIDATION_ERROR", "ID de comentario inválido", 400)

    mongo = get_mongo()
    comment = mongo.comments.find_one({"_id": oid, "deleted_at": None})
    if not comment:
        return err("NOT_FOUND", "Comentario no encontrado", 404)
    if (resp := forbid_unless_owner_or_moderator(comment.get("author_id"))):
        return resp

    mongo.comments.update_one(
        {"_id": oid},
        {"$set": {"deleted_at": datetime.now(timezone.utc), "status": "removed"}}
    )
    return "", 204


# vote a comment
@comments_bp.route("/comments/<string:comment_id>/vote", methods=["POST"])
@require_auth
def vote_comment(comment_id):
    oid = _parse_oid(comment_id)
    if not oid:
        return err("VALIDATION_ERROR", "ID de comentario inválido", 400)

    data = request.get_json()
    if not data or "vote_type" not in data:
        return err("VALIDATION_ERROR", "vote_type (1 o -1) es obligatorio", 400)
    if data["vote_type"] not in (1, -1):
        return err("VALIDATION_ERROR", "vote_type debe ser 1 (upvote) o -1 (downvote)", 400)

    mongo = get_mongo()
    comment = mongo.comments.find_one({"_id": oid, "deleted_at": None})
    if not comment:
        return err("NOT_FOUND", "Comentario no encontrado", 404)

    mongo.comments.update_one({"_id": oid}, {"$inc": {"vote_score": data["vote_type"]}})
    new_score = comment.get("vote_score", 0) + data["vote_type"]
    return jsonify({"message": "Voto registrado", "vote_score": new_score})
