from flask import Blueprint, request, jsonify, g
from models import User, db
from database import get_mongo
from auth_utils import require_auth, forbid_unless_owner, forbid_unless_owner_or_moderator
from errors import err
from notifications import serialize as serialize_notification
from datetime import datetime, timezone

users_bp = Blueprint("users", __name__)

# Nota: no hay POST /users. Con Auth0, el alta ocurre en el callback de OAuth
# (provisioning por `sub`); mantener un alta manual sería un bypass del flujo.


# list all users
@users_bp.route("/users", methods=["GET"])
def get_users():
    users = User.query.filter_by(deleted_at=None).all()
    return jsonify({"users": [u.to_dict() for u in users]})


# get a user by ID
@users_bp.route("/users/<int:user_id>", methods=["GET"])
def get_user(user_id):
    user = User.query.filter_by(id=user_id, deleted_at=None).first()
    if not user:
        return err("NOT_FOUND", "Usuario no encontrado", 404)
    return jsonify({"user": user.to_dict()})


# update user (solo el propio perfil)
@users_bp.route("/users/<int:user_id>", methods=["PUT"])
@require_auth
def update_user(user_id):
    if (resp := forbid_unless_owner(user_id)):
        return resp
    user = User.query.filter_by(id=user_id, deleted_at=None).first()
    if not user:
        return err("NOT_FOUND", "Usuario no encontrado", 404)

    data = request.get_json() or {}
    if "display_name" in data:
        user.display_name = data["display_name"]
    if "avatar_url" in data:
        user.avatar_url = data["avatar_url"]
    if "bio" in data:
        user.bio = data["bio"]
    if "gender" in data:
        user.gender = data["gender"]
    if "career_id" in data:
        user.career_id = data["career_id"]

    db.session.commit()
    return jsonify({"message": "Usuario actualizado", "user": user.to_dict()})


# notificaciones del usuario (solo las suyas), desde MongoDB
@users_bp.route("/users/<int:user_id>/notifications", methods=["GET"])
@require_auth
def get_notifications(user_id):
    if (resp := forbid_unless_owner(user_id)):
        return resp
    mongo = get_mongo()
    try:
        docs = list(
            mongo.notifications
            .find({"user_id": user_id})
            .sort("created_at", -1)
            .limit(50)
        )
    except Exception:
        docs = []  # Mongo caído → lista vacía, no 500
    return jsonify({"data": [serialize_notification(n) for n in docs]})


# marcar todas las notificaciones como leídas
@users_bp.route("/users/<int:user_id>/notifications/read", methods=["PATCH"])
@require_auth
def mark_notifications_read(user_id):
    if (resp := forbid_unless_owner(user_id)):
        return resp
    try:
        get_mongo().notifications.update_many(
            {"user_id": user_id, "is_read": False},
            {"$set": {"is_read": True}},
        )
    except Exception:
        pass
    return "", 204


# delete user (soft delete): la propia cuenta, o un moderador desactivando a un usuario
@users_bp.route("/users/<int:user_id>", methods=["DELETE"])
@require_auth
def delete_user(user_id):
    if (resp := forbid_unless_owner_or_moderator(user_id)):
        return resp
    user = User.query.filter_by(id=user_id, deleted_at=None).first()
    if not user:
        return err("NOT_FOUND", "Usuario no encontrado", 404)

    user.deleted_at = datetime.now(timezone.utc)
    user.status = "inactive"
    db.session.commit()
    return "", 204
