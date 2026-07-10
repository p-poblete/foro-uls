# Backend — HablaLaSalle (Readuls)

API REST en **Flask**, autenticación delegada a **Auth0** (OAuth 2.0 /
OIDC), persistencia en **PostgreSQL** (datos relacionales) y **MongoDB**
(comentarios, notificaciones, reportes), imágenes en **S3-compatible**
(MinIO local / Cloudflare R2 en producción).

## Resumen técnico

| | |
|---|---|
| Framework | Flask 3, blueprints por dominio |
| Servidor de producción | gunicorn (`app:create_app()`) |
| ORM | Flask-SQLAlchemy (PostgreSQL) |
| Cliente NoSQL | PyMongo (MongoDB) |
| Auth | Auth0 — Authorization Code + validación JWT por JWKS (`PyJWT`) |
| Almacenamiento | boto3 (S3-compatible: MinIO / Cloudflare R2) |
| Despliegue | Google Cloud Run (`gcloud run deploy --source backend`) |

## Estructura

```
backend/
├── app.py            Factory de la app: config, blueprints, CORS, error handlers
├── database.py        Conexión Postgres (SQLAlchemy) y Mongo (PyMongo) + índices
├── models.py           Modelos SQLAlchemy: User, Career, Community, CommunityMember, Post, PostVote
├── auth_utils.py        Validación de access token (JWKS) y decoradores de autorización
├── notifications.py     Helper para insertar notificaciones en Mongo (best-effort)
├── errors.py             Formato único de error + handlers globales 404/405/500
├── storage.py             Subida de imágenes a S3-compatible
├── validators.py           Validación de dominio de correo institucional
├── seed.py                  Datos de demo (idempotente)
└── routes/
    ├── auth.py        Flujo OAuth 2.0 con Auth0 (login, callback, me, logout)
    ├── users.py         Perfil de usuario, notificaciones
    ├── communities.py     Comunidades + membresías (join/leave/members)
    ├── posts.py             Publicaciones y votos
    ├── comments.py            Comentarios anidados (Mongo) y votos
    ├── reports.py               Reportes de contenido y resolución de moderación
    ├── careers.py                 Catálogo de carreras (solo lectura)
    └── uploads.py                  Subida genérica de imágenes
```

## Autenticación y autorización

La app **no implementa su propio Authorization Server**: todo el flujo OAuth
2.0 (Authorization Code) lo hospeda **Auth0**, incluyendo el login social con
Google y el consentimiento. El backend solo participa como cliente OIDC y
como *resource server*:

1. `GET /api/auth/login` redirige a Auth0 (`/authorize`) con `audience` (para
   que el token devuelto sea un JWT firmado, no un token opaco).
2. `GET /oauth/callback` recibe el `code`, lo intercambia **server-to-server**
   por un `access_token` en `/oauth/token`, provisiona el usuario local (busca
   o crea por `sub` en `users.google_id`) y redirige al frontend con el token
   en el fragmento de la URL.
3. En cada petición protegida, `auth_utils.py` valida el `access_token` contra
   las llaves públicas de Auth0 (JWKS, cacheadas por `PyJWKClient`), verificando
   firma, `aud`, `iss` y `exp`.

### Decoradores de autorización (`auth_utils.py`)

| Decorador / helper | Efecto |
|---|---|
| `@require_auth` | 401 si no hay un access token válido de un usuario existente. Deja el usuario en `g.current_user`. |
| `@require_moderator` | 401/403 si el usuario no tiene el rol `moderator` (leído del claim namespaced `AUTH0_ROLES_CLAIM`, inyectado por una Auth0 Action vía RBAC). |
| `forbid_unless_owner(owner_id)` | 403 si `g.current_user` no es el dueño del recurso. |
| `forbid_unless_owner_or_moderator(owner_id)` | Igual, pero un moderador también puede actuar (usado en edición/borrado de contenido ajeno). |

El **dominio institucional** (`@ulasalle.edu.pe`) se restringe en dos capas:
una Auth0 Action en el flujo post-login (defensa principal) y una verificación
de respaldo en `validators.py` dentro del callback.

## Modelo de datos (PostgreSQL, vía SQLAlchemy)

| Tabla | Descripción |
|---|---|
| `users` | Perfil, `google_id` (= `sub` de Auth0), `auth_provider`, soft delete |
| `careers` | Catálogo de carreras (dato de referencia) |
| `communities` | Nombre, slug, descripción, `owner_id`, `visibility` (public/restricted/private), `status` (active/suspended/archived) |
| `community_members` | Membresía usuario↔comunidad, `role` (member/owner), `status` (active/pending) |
| `posts` | Publicación con `label`, `image_url`, `vote_score`, soft delete |
| `post_votes` | Un voto por (post, usuario) — constraint único |

Las tablas se crean automáticamente con `db.create_all()` al arrancar la app
(no requiere migraciones para este alcance). Detalle completo en
[`../bd/README.md`](../bd/README.md).

## Colecciones (MongoDB)

| Colección | Uso |
|---|---|
| `comments` | Comentarios anidados con *materialized path* (`parent_id`, `depth`) |
| `notifications` | Notificaciones de usuario (ver sección siguiente) |
| `reports` | Reportes de contenido y su resolución |

## Endpoints

Prefijo `/api` salvo `/oauth/callback`. Colección Postman completa en
[`../postman_collection.json`](../postman_collection.json).

**Auth**
- `GET /api/auth/login` — inicia el Authorization Code flow con Auth0
- `GET /oauth/callback` — canjea el `code`, provisiona el usuario
- `GET /api/auth/me` — usuario autenticado (valida el Bearer token)
- `GET /api/auth/logout` — cierra también la sesión SSO en Auth0

**Usuarios**
- `GET /api/users`, `GET /api/users/<id>` — públicos
- `PUT /api/users/<id>`, `DELETE /api/users/<id>` — dueño (o moderador para desactivar)
- `GET /api/users/<id>/notifications` — dueño
- `PATCH /api/users/<id>/notifications/read` — marca todas como leídas

**Comunidades**
- `GET /api/communities`, `GET /api/communities/<id>` — públicos (incluyen `member_count` y `membership` si hay token)
- `POST /api/communities` — autenticado (visibilidad configurable)
- `PUT /api/communities/<id>`, `DELETE /api/communities/<id>` — dueño o moderador
- `POST /api/communities/<id>/join` — pública=activo, restringida=pendiente, privada=403
- `POST /api/communities/<id>/leave`
- `GET /api/communities/<id>/members` — pendientes visibles solo para el dueño
- `PATCH /api/communities/<id>/members/<user_id>` — aprobar (dueño)
- `DELETE /api/communities/<id>/members/<user_id>` — expulsar (dueño) o cancelar solicitud propia

**Publicaciones**
- `GET /api/posts`, `GET /api/communities/<id>/posts`, `GET /api/posts/<id>` — públicos
- `POST /api/posts`, `PUT /api/posts/<id>` — autor (edición también moderador)
- `DELETE /api/posts/<id>` — autor o moderador
- `POST /api/posts/<id>/vote`

**Comentarios**
- `GET /api/posts/<id>/comments`, `GET /api/users/<id>/comments`, `GET /api/comments/<id>` — públicos
- `POST /api/posts/<id>/comments`, `PUT /api/comments/<id>` — autor (edición también moderador)
- `DELETE /api/comments/<id>` — autor o moderador
- `POST /api/comments/<id>/vote`

**Reportes (moderación)**
- `POST /api/reports` — cualquier usuario autenticado
- `GET /api/reports` — solo `moderator`
- `PATCH /api/reports/<id>` — solo `moderator`; resuelve con `status`, `action` (`remove` banea el contenido) y `note` (motivo)

**Otros**
- `GET /api/careers` — público
- `POST /api/uploads` — autenticado; sube a S3-compatible y devuelve la URL pública

## Sistema de notificaciones

Todas se generan como efecto secundario de otra acción y se insertan en Mongo
de forma *best-effort* (si Mongo no responde, la acción principal no falla).

| Tipo | Se dispara cuando | Destinatario | Anónima |
|---|---|---|---|
| `LIKE` / `DISLIKE` | Alguien vota tu publicación | Autor del post | No |
| `COMMENT` | Alguien comenta tu publicación | Autor del post | No |
| `REPLY` | Alguien responde tu comentario | Autor del comentario padre | No |
| `COMMUNITY_POST` | Nueva publicación en tu comunidad | Miembros activos | No |
| `ANNOUNCEMENT` | Publicación con label `ANNOUNCEMENT` | Miembros activos | No |
| `REPORT_RECEIVED` | Reportan tu contenido | Autor del contenido | **Sí** |
| `REPORT_RESOLVED` | Se resuelve un reporte | Reportante y autor | Depende |
| `CONTENT_REMOVED` | Un moderador banea tu contenido | Autor | **Sí** |
| `CONTENT_EDITED` | Un moderador edita tu contenido | Autor | **Sí** |

Las notificaciones anónimas (`trigger_user_id = null`) nunca revelan quién
reportó o moderó — el frontend las pinta sin autor. Todas llevan un `message`
en texto natural generado por el backend (incluye el motivo cuando aplica).

## Flujo de moderación de contenido

1. Un usuario reporta una publicación o comentario (`POST /api/reports`) → el
   autor recibe un aviso anónimo con el motivo del reporte.
2. Un moderador revisa el reporte en el panel y lo resuelve
   (`PATCH /api/reports/<id>`) con tres desenlaces posibles:
   - **Eliminar** (`action: "remove"`): soft-delete de la publicación o
     comentario reportado.
   - **Mantener**: el contenido sigue publicado.
   - **Descartar**: el reporte se cierra sin acción sobre el contenido.
3. En los tres casos, el reportante y el autor reciben notificación con el
   veredicto y el motivo que escribió el moderador. El reportante nunca se
   revela al autor.

## Variables de entorno

Ver [`.env.example`](.env.example) para la lista completa y comentada:
conexión a Postgres/Mongo, credenciales S3, `FLASK_SECRET_KEY`,
`ALLOWED_EMAIL_DOMAIN` y las variables `AUTH0_*` (domain, client id/secret,
audience, callback URL, claim de roles).

## Desarrollo local

```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # o .venv\Scripts\activate en Windows
pip install -r requirements.txt
cp .env.example .env   # completa los valores
python seed.py         # datos de demo (idempotente)
python app.py           # http://localhost:5000
```

Con Docker (recomendado, junto al resto del stack): ver el
[README de la raíz](../README.md#arranque-rápido-local-con-docker).

## Despliegue

Desplegado en **Google Cloud Run** (`gcloud run deploy readuls --source
backend`), que construye la imagen desde el `Dockerfile` incluido. Guía
completa en [`../docs/DEPLOY.md`](../docs/DEPLOY.md).
