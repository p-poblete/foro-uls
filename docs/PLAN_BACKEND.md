# Plan Backend — Unificación con Frontend v1

## Estado actual

- CRUD completo para: users, communities, posts (con S3), comments (MongoDB).
- **Sin autenticación**: ninguna ruta valida identidad, no hay `external_auth_id` en el modelo `User`, no se verifica ningún token.
- Las respuestas de posts no incluyen datos del autor ni `comment_count`.
- No existen endpoints de: auth, careers, feed agregado, membership de comunidades, búsqueda.
- Los nombres de campos en `to_dict()` no coinciden en todos los casos con los tipos del frontend (ej. `avatar_url` vs `profile_image`).

---

## Paso 1 — Dependencias nuevas

Agregar a `backend/requirements.txt`:
```
python-jose[cryptography]>=3.3.0
requests>=2.31.0
```

`python-jose` verifica el JWT de Auth0 usando su clave pública (RS256). No se necesita `bcrypt` ni `flask-jwt-extended` porque el backend nunca emite ni almacena contraseñas — solo valida tokens emitidos por Auth0.

Agregar a `app.py` la configuración de Auth0:
```python
app.config["AUTH0_DOMAIN"]   = os.getenv("AUTH0_DOMAIN")
app.config["AUTH0_AUDIENCE"] = os.getenv("AUTH0_AUDIENCE")
```

---

## Paso 2 — Modelos: campos faltantes y tablas nuevas

### 2.1 Actualizar `User` en `models.py`
Agregar columnas:
```python
external_auth_id = db.Column(db.String(200), unique=True)   # sub del JWT de Auth0
auth_provider    = db.Column(db.String(50),  default="auth0")
gender           = db.Column(db.String(20))   # MALE / FEMALE / NON_BINARY
career_id        = db.Column(db.Integer, db.ForeignKey("careers.id", ondelete="SET NULL"))
profile_image    = db.Column(db.Text)         # renombrar desde avatar_url
cover_image      = db.Column(db.Text)
```
Actualizar `to_dict()` para usar los nuevos nombres de campo y que coincidan con `UserProfile` del frontend.

### 2.2 Nuevo modelo `Career`
```python
class Career(db.Model):
    __tablename__ = "careers"
    id   = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    code = db.Column(db.String(20), nullable=False, unique=True)

    def to_dict(self):
        return {"id": self.id, "name": self.name, "code": self.code}
```

### 2.3 Nuevo modelo `CommunityMember`
```python
class CommunityMember(db.Model):
    __tablename__  = "community_members"
    __table_args__ = (db.UniqueConstraint("community_id", "user_id"),)
    id           = db.Column(db.Integer, primary_key=True)
    community_id = db.Column(db.Integer, db.ForeignKey("communities.id", ondelete="CASCADE"), nullable=False)
    user_id      = db.Column(db.Integer, db.ForeignKey("users.id",       ondelete="CASCADE"), nullable=False)
    role         = db.Column(db.String(20), nullable=False, default="member")
    joined_at    = db.Column(db.DateTime(timezone=True), nullable=False, default=_now)
```

### 2.4 Actualizar `Community`
Agregar:
```python
profile_image = db.Column(db.Text)
cover_image   = db.Column(db.Text)
member_count  = db.Column(db.Integer, nullable=False, default=0)
```

---

## Paso 3 — Autenticación con Auth0

El backend no emite tokens ni maneja contraseñas. Su único trabajo de auth es:
1. Verificar que el token Bearer que llega en el header fue emitido por Auth0.
2. Extraer el `sub` del token para identificar al usuario local.
3. Si el usuario no existe en la BD (primer login), crearlo automáticamente.

### 3.1 Helper de verificación (`backend/auth.py`)

```python
import requests
from functools import wraps
from flask import request, current_app, g
from jose import jwt, JWTError

def _get_jwks():
    domain = current_app.config["AUTH0_DOMAIN"]
    return requests.get(f"https://{domain}/.well-known/jwks.json").json()

def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return {"error": {"code": "MISSING_TOKEN", "message": "Token requerido"}}, 401
        token = auth_header.split(" ")[1]
        try:
            payload = jwt.decode(
                token,
                _get_jwks(),
                algorithms=["RS256"],
                audience=current_app.config["AUTH0_AUDIENCE"],
            )
        except JWTError:
            return {"error": {"code": "INVALID_TOKEN", "message": "Token inválido"}}, 401

        # Buscar o crear el usuario local
        from models import User, db
        user = User.query.filter_by(external_auth_id=payload["sub"]).first()
        if not user:
            user = User(
                external_auth_id=payload["sub"],
                auth_provider="auth0",
                email=payload.get("email", ""),
                username=payload.get("nickname") or payload["sub"].replace("|", "_"),
                display_name=payload.get("name", ""),
                profile_image=payload.get("picture"),
            )
            db.session.add(user)
            db.session.commit()

        g.current_user = user
        return f(*args, **kwargs)
    return decorated

def current_user():
    return g.current_user
```

> **Nota sobre JWKS en producción**: `_get_jwks()` hace una llamada HTTP en cada request. Para producción, cachear el resultado en memoria con un TTL de ~24h (las claves de Auth0 rotan con poca frecuencia).

### 3.2 Endpoint `POST /api/auth/me`

Ruta opcional pero útil: el frontend la llama al cargar la app para obtener el perfil local del usuario autenticado (incluye `career`, `id` interno, etc.):

```python
@auth_bp.route("/auth/me", methods=["GET"])
@require_auth
def me():
    return jsonify({"user": current_user().to_dict()})
```

No existe `POST /api/auth/register` ni `POST /api/auth/login` — Auth0 los reemplaza completamente.

---

## Paso 4 — Careers

Crear `backend/routes/careers.py`:

### `GET /api/careers`
Ruta pública. Devuelve todas las carreras.
```python
careers = Career.query.order_by(Career.name).all()
return jsonify({"careers": [c.to_dict() for c in careers]})
```

Registrar en `app.py`.

---

## Paso 5 — Membership de comunidades

Agregar a `backend/routes/communities.py`:

### `POST /api/communities/<id>/join` — requiere auth
```python
@jwt_required()
def join_community(community_id):
    user_id = current_user_id()
    # verificar que no sea ya miembro
    # crear CommunityMember
    # incrementar community.member_count
```

### `DELETE /api/communities/<id>/leave` — requiere auth
```python
@jwt_required()
def leave_community(community_id):
    # eliminar CommunityMember
    # decrementar community.member_count
```

Actualizar `GET /api/communities/<id>` para que incluya `is_member: bool` cuando hay JWT presente (opcional en header).

---

## Paso 6 — Mejorar respuestas de posts

### 6.1 Incluir datos del autor
En `Post.to_dict()` o en el endpoint, hacer join con `User` para incluir:
```json
"author": {
  "id": 1,
  "username": "ppoblete",
  "profile_image": "...",
  "career": { "id": 3, "name": "Ingeniería de Software", "code": "sft" }
}
```

### 6.2 Incluir `comment_count`
Opción A (simple): guardar un campo `comment_count` en el modelo `Post` e incrementarlo en `POST /api/posts/<id>/comments`.  
Opción B: hacer COUNT en MongoDB al listar posts (más costoso).  
**Recomendado para v1: Opción A.**

### 6.3 Feed global
Agregar a `backend/routes/posts.py`:

### `GET /api/posts` — público
```
Query params: limit (default 20), offset (default 0), label, author_id, career_code
```
```python
query = Post.query.filter_by(deleted_at=None, status="active")
if label:
    query = query.filter_by(label=label)
posts = query.order_by(Post.created_at.desc()).limit(limit).offset(offset).all()
return jsonify({"posts": [p.to_dict() for p in posts], "has_more": ...})
```

---

## Paso 7 — Proteger rutas con `@require_auth`

| Ruta | Método | Tipo |
|---|---|---|
| `POST /api/posts` | escritura | requiere auth |
| `PUT /api/posts/<id>` | escritura | requiere auth + ser autor |
| `DELETE /api/posts/<id>` | escritura | requiere auth + ser autor |
| `POST /api/posts/<id>/vote` | escritura | requiere auth |
| `POST /api/posts/<id>/comments` | escritura | requiere auth |
| `PUT /api/comments/<id>` | escritura | requiere auth + ser autor |
| `DELETE /api/comments/<id>` | escritura | requiere auth + ser autor |
| `POST /api/comments/<id>/vote` | escritura | requiere auth |
| `POST /api/communities` | escritura | requiere auth |
| `PUT /api/communities/<id>` | escritura | requiere auth + ser owner |
| `DELETE /api/communities/<id>` | escritura | requiere auth + ser owner |
| `PUT /api/users/<id>` | escritura | requiere auth + ser el propio usuario |
| `GET /api/auth/me` | lectura | requiere auth |

En las rutas protegidas, eliminar el campo `author_id` / `user_id` del body y obtenerlo siempre con `current_user().id`.

---

## Paso 8 — CORS y manejo de errores

### CORS
Actualizar la configuración en `app.py` para permitir el origen del frontend en desarrollo:
```python
CORS(app, resources={r"/api/*": {"origins": ["http://localhost:5173", "http://localhost:3000"]}})
```

### Formato de errores estandarizado
Todos los errores deben seguir el formato que `ApiError` del frontend ya espera:
```json
{ "error": { "code": "USER_NOT_FOUND", "message": "Usuario no encontrado" } }
```
Crear un helper `error_response(code, message, status)` y usarlo en todos los blueprints.

---

## Paso 9 — Búsqueda (puede quedar para iteración 2)

### `GET /api/search?q=<query>`
Buscar en `Post.title` e `Post.content` con `ILIKE '%query%'` en PostgreSQL.  
Buscar en `Community.name` y `Community.description`.  
Retornar `{ posts: [...], communities: [...] }`.

---

## Orden de ejecución

```
1. Paso 1 — instalar dependencias, configurar Auth0 en app.py
2. Paso 2 — actualizar modelos (User con external_auth_id, Career, CommunityMember, Community)
3. Paso 3 — helper require_auth + endpoint GET /api/auth/me
4. Paso 4 — careers endpoint
5. Paso 6 — mejorar respuestas de posts (autor + comment_count + feed global)
6. Paso 5 — membership join/leave
7. Paso 7 — proteger rutas con @require_auth
8. Paso 8 — CORS + errores estandarizados
9. Paso 9 — búsqueda (iteración 2)
```
