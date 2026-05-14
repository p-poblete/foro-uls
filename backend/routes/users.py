from flask import Blueprint, request, jsonify
from models import User, db
from datetime import datetime, timezone

users_bp = Blueprint("users", __name__)


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
        return jsonify({"error": "Usuario no encontrado"}), 404
    return jsonify({"user": user.to_dict()})


# create a new user
@users_bp.route("/users", methods=["POST"])
def create_user():
    data = request.get_json()
    if not data or not data.get("username") or not data.get("email") or not data.get("display_name"):
        return jsonify({"error": "username, email y display_name son obligatorios"}), 400

    if User.query.filter_by(username=data["username"]).first():
        return jsonify({"error": "El username ya existe"}), 409
    if User.query.filter_by(email=data["email"]).first():
        return jsonify({"error": "El email ya existe"}), 409

    user = User(
        username=data["username"],
        email=data["email"],
        display_name=data["display_name"],
        avatar_url=data.get("avatar_url"),
        bio=data.get("bio"),
    )
    db.session.add(user)
    db.session.commit()
    return jsonify({"message": "Usuario creado", "user": user.to_dict()}), 201


# update user
@users_bp.route("/users/<int:user_id>", methods=["PUT"])
def update_user(user_id):
    user = User.query.filter_by(id=user_id, deleted_at=None).first()
    if not user:
        return jsonify({"error": "Usuario no encontrado"}), 404

    data = request.get_json() or {}
    if "display_name" in data:
        user.display_name = data["display_name"]
    if "avatar_url" in data:
        user.avatar_url = data["avatar_url"]
    if "bio" in data:
        user.bio = data["bio"]

    db.session.commit()
    return jsonify({"message": "Usuario actualizado", "user": user.to_dict()})


# delete user (soft delete)
@users_bp.route("/users/<int:user_id>", methods=["DELETE"])
def delete_user(user_id):
    user = User.query.filter_by(id=user_id, deleted_at=None).first()
    if not user:
        return jsonify({"error": "Usuario no encontrado"}), 404

    user.deleted_at = datetime.now(timezone.utc)
    user.status = "inactive"
    db.session.commit()
    return jsonify({"message": "Usuario eliminado", "user": user.to_dict()})
