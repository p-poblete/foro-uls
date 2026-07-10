# Base de datos — HablaLaSalle (Readuls)

El proyecto usa **dos motores de base de datos**, cada uno para el tipo de
dato al que mejor se ajusta.

> **Importante:** el esquema que corre en producción **no se ejecuta desde los
> scripts `.sql`/`.js` de esta carpeta**. Se genera automáticamente con
> `db.create_all()` de SQLAlchemy a partir de [`../backend/models.py`](../backend/models.py)
> al arrancar el backend. Los scripts en `postgres/` y `mongo/` son el
> **diseño de referencia** producido en la etapa de planificación (con UUID
> PKs y campos pensados para una versión multi-universidad futura) y quedan
> documentados abajo para trazabilidad, pero difieren del esquema real en
> nombres de columna y tipos de clave. Esta sección describe primero **lo que
> realmente está desplegado**.

## Por qué dos bases de datos

| | PostgreSQL | MongoDB |
|---|---|---|
| Qué guarda | Usuarios, comunidades, membresías, publicaciones, votos, carreras | Comentarios, notificaciones, reportes |
| Por qué | Datos con relaciones fuertes e integridad referencial (FKs, uniques), consultas con *joins* | Documentos de alta escritura y forma variable — un hilo de comentarios, una notificación o un reporte no necesitan esquema rígido ni *joins* |
| Ejemplo concreto | Un voto no puede existir sin su post y su usuario (`FOREIGN KEY` + `UNIQUE(post_id, user_id)`) | Un comentario puede tener 0..N respuestas anidadas de profundidad arbitraria — modelarlo en tablas relacionales exigiría *joins* recursivos costosos |

## PostgreSQL — esquema real (SQLAlchemy, `backend/models.py`)

Creado con `db.create_all()` al iniciar el backend (ver
[`../backend/database.py`](../backend/database.py)); no requiere migraciones
para el alcance de este proyecto.

### `users`
| Columna | Tipo | Notas |
|---|---|---|
| `id` | `SERIAL PK` | |
| `username` | `VARCHAR(50)` | único |
| `email` | `VARCHAR(255)` | único |
| `display_name` | `VARCHAR(100)` | |
| `avatar_url`, `bio` | `TEXT` | |
| `status` | `VARCHAR(20)` | default `active` |
| `gender` | `VARCHAR(20)` | |
| `career_id` | `INTEGER` | FK → `careers.id`, `ON DELETE SET NULL` |
| `google_id` | `VARCHAR(255)` | único; guarda el **`sub` de Auth0** (nombre heredado de la integración original con Google, reutilizado para no migrar esquema) |
| `auth_provider` | `VARCHAR(20)` | `auth0` |
| `created_at`, `updated_at`, `deleted_at` | `TIMESTAMPTZ` | soft delete vía `deleted_at IS NULL` |

### `careers`
Catálogo de referencia: `id`, `code` (único), `name`.

### `communities`
| Columna | Notas |
|---|---|
| `id`, `name` (único), `slug` (único), `description` | |
| `owner_id` | FK → `users.id`, `ON DELETE SET NULL` |
| `visibility` | `public` \| `restricted` \| `private` |
| `status` | `active` \| `suspended` \| `archived` |
| `image_url`, `banner_url` | |
| `created_at`, `updated_at`, `deleted_at` | soft delete |

### `community_members`
Relación N:M usuario↔comunidad con estado de aprobación.
| Columna | Notas |
|---|---|
| `id`, `community_id` (FK, `CASCADE`), `user_id` (FK, `CASCADE`) | `UNIQUE(community_id, user_id)` |
| `role` | `member` \| `owner` |
| `status` | `active` \| `pending` (comunidades `restricted` requieren aprobación del owner) |
| `joined_at` | |

### `posts`
| Columna | Notas |
|---|---|
| `id`, `title`, `content`, `image_url`, `external_link` | |
| `community_id` | FK → `communities.id`, `CASCADE` |
| `author_id` | FK → `users.id`, `SET NULL` |
| `label` | `HELP` \| `ANNOUNCEMENT` \| `DISCUSSION` \| `CASE` |
| `post_type` | `text` \| `image` |
| `vote_score` | contador desnormalizado, mantenido por la API al votar |
| `status` | `active` \| `removed` |
| `created_at`, `updated_at`, `deleted_at` | soft delete |

### `post_votes`
Un voto por (post, usuario): `UNIQUE(post_id, user_id)`. `vote_type` es `1`
(upvote) o `-1` (downvote); cambiar o repetir el voto actualiza/borra la fila
y ajusta `posts.vote_score` de forma atómica en la misma transacción.

## MongoDB — colecciones reales

Sin *schema validators* activos (se insertan directamente vía PyMongo desde
las rutas del backend); los campos abajo son los que la API realmente
escribe y lee. Índices creados en [`../backend/database.py`](../backend/database.py).

### `comments`
Árbol de comentarios con **materialized path simplificado** (referencia al
padre directo, no un path completo — suficiente para reconstruir el árbol
con una consulta por post).

| Campo | Notas |
|---|---|
| `_id` | `ObjectId` |
| `post_id` | id entero del post (Postgres) |
| `author_id` | id entero del usuario (Postgres) |
| `parent_id` | `ObjectId` del comentario padre, o `null` (raíz) |
| `depth` | profundidad calculada al crear (padre.depth + 1) |
| `content`, `image_url` | |
| `vote_score` | contador, incrementado atómicamente (`$inc`) |
| `status` | `active` \| `removed` |
| `created_at`, `updated_at`, `deleted_at` | soft delete |

**Índices:** `{post_id, parent_id}` (armar el árbol), `{post_id, created_at:-1}` (orden cronológico).

### `notifications`
| Campo | Notas |
|---|---|
| `user_id` | destinatario |
| `type` | `LIKE`, `DISLIKE`, `COMMENT`, `REPLY`, `COMMUNITY_POST`, `ANNOUNCEMENT`, `REPORT_RECEIVED`, `REPORT_RESOLVED`, `CONTENT_REMOVED`, `CONTENT_EDITED` |
| `trigger_user_id` | usuario que originó la notificación, o `null` si es **anónima** (reportes/moderación — protege la identidad de quien reporta) |
| `publication_id`, `comment_id` | referencia opcional al contenido |
| `message` | texto ya formateado (incluye el motivo cuando aplica) |
| `is_read` | |
| `created_at` | |

**Índice:** `{user_id, created_at:-1}` (listar notificaciones del usuario, más recientes primero).

### `reports`
| Campo | Notas |
|---|---|
| `target_type` | `publication` \| `comment` \| `user` \| `community` |
| `target_id`, `target_label` | |
| `reason` | `SPAM`, `HARASSMENT`, `MISINFO`, `NSFW`, `OFFTOPIC`, `OTHER` |
| `detail` | texto libre del reportante (máx. 500 chars) |
| `status` | `PENDING` \| `REVIEWED` \| `DISMISSED` |
| `reporter_id` | quien reportó (solo visible para moderadores) |
| `action` | `remove` si la resolución baneó el contenido |
| `note` | motivo del moderador, se reenvía en las notificaciones de cierre |
| `resolved_by`, `resolved_at` | |
| `created_at` | |

**Índice:** `{status, created_at:-1}` (bandeja de pendientes del panel de moderación).

## Scripts de referencia (diseño, no ejecutados)

La carpeta conserva el diseño elaborado en la etapa de planificación:

```
postgres/
├── v1_init.sql, v1/           Esquema con integer PKs (más cercano al real,
│                               pero con nombres de columna distintos:
│                               external_auth_id, profile_image, cover_image)
├── init.sql, 01_schema.sql,   Esquema objetivo de producción: UUID PKs,
│   02_triggers.sql,           multi-universidad, karma, moderation_actions,
│   03_indexes.sql             search vectors — no implementado en esta versión
mongo/
├── init.js
├── 01_collections.js          Colecciones con JSON Schema validator (incluye
│                               campos como `path` completo y `community_id`
│                               en comments, no usados por el backend actual)
└── 02_indexes.js
```

Se mantienen como documentación de la arquitectura objetivo y como base para
una futura migración con Flask-Migrate/Alembic si el proyecto escala más allá
del alcance del curso. **No se usan para levantar el entorno actual** — eso
lo hace `db.create_all()` al arrancar `backend/app.py`.

## Cómo se crea la base de datos hoy

No hace falta correr ningún script manualmente:

```bash
cd backend
python app.py     # o: docker compose up  (desde la raíz)
```

`create_app()` llama a `db.create_all()` dentro del contexto de la app, que
crea las tablas de Postgres si no existen (tolerante a que Postgres no esté
disponible, para poder levantar el resto del sistema en modo demo). Mongo no
requiere creación de esquema: las colecciones e índices se crean al primer
uso (`init_mongo()` en `database.py`).

## Configuración de conexión

Ver `POSTGRES_URL`, `MONGO_URL`, `MONGO_DB` y `MONGO_TIMEOUT_MS` en
[`../backend/.env.example`](../backend/.env.example). En producción:
PostgreSQL en **Neon** (`sslmode=require`) y MongoDB en **MongoDB Atlas**
(cadena `mongodb+srv://`).
