"""Autorización: valida el access token (JWT) emitido por Auth0 en cada request.

El frontend manda el `access_token` de Auth0 en `Authorization: Bearer`. Aquí se
valida su firma contra las llaves públicas de Auth0 (JWKS) y sus claims
(`aud` == AUTH0_AUDIENCE, `iss`, `exp`), y se resuelve el usuario local por su
`sub`. El ownership se ancla en la identidad verificada por el proveedor de
terceros (Auth0), no en un id que mande el cliente.

Flujo: OAuth 2.0 Authorization Code (canje del code en routes/auth.py, delegado
a Auth0) → access_token JWT → este módulo lo valida en cada endpoint protegido.
"""
import os
from functools import wraps

import jwt
from jwt import PyJWKClient
from flask import request, g

from models import User
from errors import err

AUTH0_DOMAIN   = os.getenv("AUTH0_DOMAIN")
AUTH0_AUDIENCE = os.getenv("AUTH0_AUDIENCE")
_ISSUER   = f"https://{AUTH0_DOMAIN}/" if AUTH0_DOMAIN else None
_JWKS_URL = f"https://{AUTH0_DOMAIN}/.well-known/jwks.json" if AUTH0_DOMAIN else None

# PyJWKClient cachea las llaves públicas de Auth0 → evita una descarga por request.
_jwk_client = PyJWKClient(_JWKS_URL) if _JWKS_URL else None


def _bearer_token():
    header = request.headers.get("Authorization", "")
    return header[7:].strip() if header.startswith("Bearer ") else None


def verify_access_token(token):
    """Devuelve los claims si el access token es válido; None en cualquier fallo.

    jwt.decode valida firma (JWKS RS256), `aud` (== AUTH0_AUDIENCE), `iss`
    (el tenant de Auth0) y `exp`. Lanza si algo no cuadra.
    """
    if not token or not _jwk_client or not AUTH0_AUDIENCE:
        return None
    try:
        signing_key = _jwk_client.get_signing_key_from_jwt(token).key
        return jwt.decode(
            token,
            signing_key,
            algorithms=["RS256"],
            audience=AUTH0_AUDIENCE,
            issuer=_ISSUER,
        )
    except Exception:
        return None


def current_user():
    """Usuario autenticado (o None) resuelto desde el Bearer access_token por su `sub`."""
    claims = verify_access_token(_bearer_token())
    if not claims:
        return None
    return User.query.filter_by(google_id=claims["sub"], deleted_at=None).first()


def _claims():
    """Claims del token validado del request actual (o None). Útil para leer roles."""
    return verify_access_token(_bearer_token())


def require_auth(fn):
    """401 si el request no trae un access token válido de un usuario existente.
    Deja el usuario en `g.current_user` para los checks de ownership."""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        user = current_user()
        if user is None:
            return err("UNAUTHORIZED", "Autenticación requerida", 401)
        g.current_user = user
        return fn(*args, **kwargs)
    return wrapper


def is_moderator():
    """True si el token del request trae el rol `moderator` (RBAC de Auth0)."""
    roles_claim = os.getenv("AUTH0_ROLES_CLAIM", "https://readuls/roles")
    return "moderator" in ((_claims() or {}).get(roles_claim, []))


def require_moderator(fn):
    """403 si el usuario autenticado no tiene el rol `moderator` (RBAC de Auth0).
    Auth0 inyecta los roles en un claim namespaced del token (ver AUTH0_ROLES_CLAIM)."""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        user = current_user()
        if user is None:
            return err("UNAUTHORIZED", "Autenticación requerida", 401)
        if not is_moderator():
            return err("FORBIDDEN", "Requiere rol de moderador", 403)
        g.current_user = user
        return fn(*args, **kwargs)
    return wrapper


def forbid_unless_owner(owner_id):
    """Devuelve una respuesta 403 si el usuario actual no es el dueño; None si lo es.
    Uso: `if (resp := forbid_unless_owner(post.author_id)): return resp`."""
    if g.current_user.id != owner_id:
        return err("FORBIDDEN", "No autorizado: no eres el dueño de este recurso", 403)
    return None


def forbid_unless_owner_or_moderator(owner_id):
    """Como forbid_unless_owner, pero un moderador (rol Auth0) también pasa.
    Para acciones de moderación sobre contenido ajeno (borrar posts/comentarios, etc.)."""
    if g.current_user.id == owner_id or is_moderator():
        return None
    return err("FORBIDDEN", "No autorizado: requiere ser el dueño o moderador", 403)


if __name__ == "__main__":
    # Check mínimo offline del guard de validación (sin red ni app context).
    assert verify_access_token(None) is None
    assert verify_access_token("") is None
    print("auth_utils: guard OK")
