"""Google OAuth login (authorization-code flow).

El token que viaja al frontend es un identificador firmado (itsdangerous) del
`users.id` interno en Postgres — no datos crudos de Google. `/api/auth/me`
es la única fuente confiable de identidad: el backend nunca debe confiar en
el bloque `user=` que va en la URL (es solo para pintar la UI al instante).
"""
import os
import secrets
from urllib.parse import urlencode

import requests
from flask import Blueprint, redirect, request, session, current_app, jsonify
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired

from models import User, db
from validators import is_institutional_email

auth_bp = Blueprint("auth", __name__)

CLIENT_ID     = os.getenv("GOOGLE_CLIENT_ID")
CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
REDIRECT_URI  = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:5000/oauth/callback")
FRONTEND_URL  = os.getenv("FRONTEND_URL", "http://localhost:5173")

AUTH_URL     = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL    = "https://oauth2.googleapis.com/token"
USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"
SCOPE        = "openid email profile"

TOKEN_MAX_AGE = 60 * 60 * 24 * 7  # 7 días


def _serializer():
    return URLSafeTimedSerializer(current_app.secret_key, salt="auth-token")


def _find_or_create_user(google_id, email, name, picture):
    user = User.query.filter_by(google_id=google_id).first()
    if user:
        return user

    existing = User.query.filter_by(email=email).first()
    if existing:
        existing.google_id = google_id
        existing.auth_provider = "google"
        if not existing.avatar_url:
            existing.avatar_url = picture
        db.session.commit()
        return existing

    username = email.split("@")[0] or "usuario"
    original_username = username
    counter = 1
    while User.query.filter_by(username=username).first():
        username = f"{original_username}{counter}"
        counter += 1

    user = User(
        username=username,
        email=email,
        display_name=name or username,
        avatar_url=picture,
        google_id=google_id,
        auth_provider="google",
    )
    db.session.add(user)
    db.session.commit()
    return user


# Paso 1: redirigir a Google
@auth_bp.route("/api/auth/google/login")
def google_login():
    state = secrets.token_urlsafe(16)
    session["oauth_state"] = state
    params = {
        "response_type": "code",
        "client_id":     CLIENT_ID,
        "redirect_uri":  REDIRECT_URI,
        "scope":         SCOPE,
        "state":         state,
    }
    return redirect(f"{AUTH_URL}?{urlencode(params)}")


# Paso 2: callback — canjea el code, busca/crea el usuario en Postgres
# y vuelve al frontend con un token firmado sobre el id interno.
@auth_bp.route("/oauth/callback")
def google_callback():
    if request.args.get("state") != session.get("oauth_state"):
        return "Invalid state (CSRF)", 400
    if "error" in request.args:
        return f"Error: {request.args['error']}", 400

    token_resp = requests.post(TOKEN_URL, data={
        "code":          request.args.get("code"),
        "client_id":     CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "redirect_uri":  REDIRECT_URI,
        "grant_type":    "authorization_code",
    }, timeout=10)
    if not token_resp.ok:
        return f"Error al canjear el token con Google: {token_resp.text}", 400
    access_token = token_resp.json()["access_token"]

    info = requests.get(
        USERINFO_URL,
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=10,
    ).json()

    # Solo se admiten correos institucionales @ulasalle.edu.pe.
    if not is_institutional_email(info.get("email", "")):
        return redirect(f"{FRONTEND_URL}/oauth/callback#error=dominio")

    user = _find_or_create_user(
        google_id=info["sub"],
        email=info.get("email", ""),
        name=info.get("name"),
        picture=info.get("picture"),
    )

    token = _serializer().dumps({"user_id": user.id})
    return redirect(f"{FRONTEND_URL}/oauth/callback#token={token}")


# Verifica el token firmado y devuelve el usuario real desde Postgres.
# El frontend debe usar esto (no el fragmento de la URL) para saber quién
# está autenticado.
@auth_bp.route("/api/auth/me")
def me():
    token = request.args.get("token") or request.headers.get("Authorization", "").removeprefix("Bearer ").strip()
    if not token:
        return jsonify({"error": "Falta el token"}), 401

    try:
        data = _serializer().loads(token, max_age=TOKEN_MAX_AGE)
    except SignatureExpired:
        return jsonify({"error": "Token expirado"}), 401
    except BadSignature:
        return jsonify({"error": "Token inválido"}), 401

    user = User.query.filter_by(id=data.get("user_id"), deleted_at=None).first()
    if not user:
        return jsonify({"error": "Usuario no encontrado"}), 404

    return jsonify({"user": user.to_dict()})
