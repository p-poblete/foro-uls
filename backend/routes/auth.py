"""Autenticación delegada a Auth0 (OAuth 2.0 Authorization Code).

El Authorization Server es Auth0 (un proveedor de terceros): hospeda el login y
el consent. Aquí la app actúa solo como cliente OIDC: redirige a Auth0, recibe el
`code`, lo canjea server-to-server por un `access_token` (JWT) y provisiona el
usuario local. En cada request protegido, auth_utils valida ese access_token por
JWKS y ancla la identidad en su `sub`. `/api/auth/me` es la fuente confiable para
pintar la UI (el fragmento de la URL no se usa como identidad).

El login con Google institucional (@ulasalle) vive detrás de Auth0 como una
conexión social; la restricción de dominio se aplica en una Action de Auth0 y
aquí como defensa en profundidad.
"""
import os
import secrets
from urllib.parse import urlencode

import requests
from flask import Blueprint, redirect, request, session, jsonify

from models import User, db
from validators import is_institutional_email
from auth_utils import current_user
from errors import err

auth_bp = Blueprint("auth", __name__)

AUTH0_DOMAIN  = os.getenv("AUTH0_DOMAIN")
CLIENT_ID     = os.getenv("AUTH0_CLIENT_ID")
CLIENT_SECRET = os.getenv("AUTH0_CLIENT_SECRET")
AUDIENCE      = os.getenv("AUTH0_AUDIENCE")
CALLBACK_URL  = os.getenv("AUTH0_CALLBACK_URL", "http://localhost:5000/oauth/callback")
FRONTEND_URL  = os.getenv("FRONTEND_URL", "http://localhost:5173")

AUTHORIZE_URL = f"https://{AUTH0_DOMAIN}/authorize"
TOKEN_URL     = f"https://{AUTH0_DOMAIN}/oauth/token"
USERINFO_URL  = f"https://{AUTH0_DOMAIN}/userinfo"
LOGOUT_URL    = f"https://{AUTH0_DOMAIN}/v2/logout"
SCOPE         = "openid profile email"


def _find_or_create_user(sub, email, name, picture):
    """Provisiona el usuario local a partir del `sub` de Auth0 (guardado en
    google_id para no migrar el esquema)."""
    user = User.query.filter_by(google_id=sub).first()
    if user:
        return user

    existing = User.query.filter_by(email=email).first()
    if existing:
        existing.google_id = sub
        existing.auth_provider = "auth0"
        if not existing.avatar_url:
            existing.avatar_url = picture
        db.session.commit()
        return existing

    username = (email.split("@")[0] if email else "") or "usuario"
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
        google_id=sub,
        auth_provider="auth0",
    )
    db.session.add(user)
    db.session.commit()
    return user


# Paso 1: iniciar el flujo → redirigir al Universal Login de Auth0.
# `audience` es clave: sin él, Auth0 devuelve un access_token opaco (no JWT validable).
@auth_bp.route("/api/auth/login")
def login():
    state = secrets.token_urlsafe(16)
    session["oauth_state"] = state
    params = {
        "response_type": "code",
        "client_id":     CLIENT_ID,
        "redirect_uri":  CALLBACK_URL,
        "scope":         SCOPE,
        "audience":      AUDIENCE,
        "state":         state,
    }
    return redirect(f"{AUTHORIZE_URL}?{urlencode(params)}")


# Paso 2: callback — canjea el code por tokens (server-to-server), provisiona el
# usuario y vuelve al frontend con el access_token.
@auth_bp.route("/oauth/callback")
def callback():
    if request.args.get("state") != session.get("oauth_state"):
        return "Estado inválido (CSRF)", 400
    if "error" in request.args:
        return redirect(f"{FRONTEND_URL}/oauth/callback#error={request.args['error']}")

    token_resp = requests.post(TOKEN_URL, json={
        "grant_type":    "authorization_code",
        "client_id":     CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "code":          request.args.get("code"),
        "redirect_uri":  CALLBACK_URL,
    }, timeout=10)
    if not token_resp.ok:
        return f"Error al canjear el token con Auth0: {token_resp.text}", 400
    access_token = token_resp.json().get("access_token")
    if not access_token:
        return "Auth0 no devolvió access_token (¿falta configurar el audience/API?)", 400

    info = requests.get(
        USERINFO_URL,
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=10,
    ).json()

    # Defensa en profundidad: solo correos institucionales (la Action de Auth0 ya
    # debería bloquear el resto).
    if not is_institutional_email(info.get("email", "")):
        return redirect(f"{FRONTEND_URL}/oauth/callback#error=dominio")

    _find_or_create_user(
        sub=info["sub"],
        email=info.get("email", ""),
        name=info.get("name"),
        picture=info.get("picture"),
    )
    return redirect(f"{FRONTEND_URL}/oauth/callback#token={access_token}")


# Valida el access token (Bearer) por JWKS y devuelve el usuario real.
@auth_bp.route("/api/auth/me")
def me():
    user = current_user()
    if user is None:
        return err("UNAUTHORIZED", "Token inválido o ausente", 401)
    return jsonify({"user": user.to_dict()})


# Cierra la sesión SSO en Auth0 y regresa al frontend. El frontend limpia su
# sesión local antes de redirigir aquí.
@auth_bp.route("/api/auth/logout")
def logout():
    params = {"client_id": CLIENT_ID, "returnTo": FRONTEND_URL}
    return redirect(f"{LOGOUT_URL}?{urlencode(params)}")
