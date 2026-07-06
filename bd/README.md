# Readuls — Scripts de Base de Datos

## Estructura

```
bd/
├── postgres/
│   ├── v1_init.sql       ← punto de entrada v1 (usar para desarrollo)
│   ├── v1/
│   │   ├── 01_tables.sql    ← tablas con integer PKs (compatible con el ORM)
│   │   ├── 02_triggers.sql  ← updated_at, member_count, vote_score
│   │   ├── 03_indexes.sql   ← índices de performance
│   │   └── 04_seed.sql      ← carreras ULS + usuario demo
│   ├── init.sql          ← punto de entrada esquema de producción (UUID PKs)
│   ├── 01_schema.sql     ← esquema objetivo: CREATE TABLE con UUID PKs
│   ├── 02_triggers.sql   ← triggers completos (karma, contadores, search vector)
│   └── 03_indexes.sql    ← índices compuestos avanzados
└── mongo/
    ├── init.js           ← punto de entrada
    ├── 01_collections.js ← createCollection con validadores JSON Schema
    └── 02_indexes.js     ← createIndex (incluyendo TTL y unique)
```

## PostgreSQL — v1 (usar en desarrollo)

El esquema v1 usa **integer PKs** y es el que el ORM Flask-SQLAlchemy
(`backend/models.py`) genera con `db.create_all()`. Es el que se usa
en desarrollo y en el deploy de la primera versión del sistema.

### Requisitos
- PostgreSQL 14+

### Configuración inicial (una sola vez)

```bash
# Como superusuario de PostgreSQL:
psql -U postgres -c "CREATE DATABASE readuls;"
psql -U postgres -c "CREATE USER readuls WITH PASSWORD 'readuls123';"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE readuls TO readuls;"
```

### Ejecución

```bash
# Desde la raíz del proyecto:
psql -U readuls -d readuls -f bd/postgres/v1_init.sql

# O script a script:
psql -U readuls -d readuls -f bd/postgres/v1/01_tables.sql
psql -U readuls -d readuls -f bd/postgres/v1/02_triggers.sql
psql -U readuls -d readuls -f bd/postgres/v1/03_indexes.sql
psql -U readuls -d readuls -f bd/postgres/v1/04_seed.sql
```

### Tablas creadas (v1)

| Tabla | Descripción |
|---|---|
| `careers` | Carreras de ULS |
| `users` | Usuarios autenticados vía Auth0 |
| `communities` | Comunidades de discusión |
| `community_members` | Membresías usuario ↔ comunidad |
| `posts` | Publicaciones con label y tags |
| `post_votes` | Votos en posts (1 por usuario) |

### Convenciones v1
- PK: `SERIAL` (integer auto-increment)
- Auth: `external_auth_id` = `sub` del JWT de Auth0
- Timestamps: `TIMESTAMPTZ` (UTC)
- Soft delete: `deleted_at IS NULL` = activo
- `comment_count` en posts es desnormalizado: el backend lo actualiza al crear/eliminar comentarios en MongoDB

---

## PostgreSQL — Producción (referencia futura)

El esquema en `01_schema.sql` es el diseño objetivo con **UUID PKs**,
soporte multi-universidad, karma, moderación y search vectors.
Se activará en una iteración posterior migrando con Flask-Migrate (Alembic).

### Requisitos
- PostgreSQL 16+
- Extensiones: `pgcrypto`, `pg_trgm`

### Ejecución

```bash
psql -U postgres -d readuls -f bd/postgres/init.sql
```

### Tablas creadas (producción)

| Tabla | Descripción |
|---|---|
| `users` | Perfiles universitarios |
| `universities` | Catálogo de universidades |
| `careers` | Carreras por universidad |
| `communities` | Espacios de discusión |
| `community_members` | Membresías (N:M) |
| `posts` | Publicaciones |
| `post_media` | Multimedia adjunta |
| `tags` | Etiquetas reutilizables |
| `post_tags` | Tags por post (N:M) |
| `post_votes` | Votos en posts |
| `notifications` | Notificaciones persistentes |
| `reports` | Reportes de contenido |
| `moderation_actions` | Log de moderación (append-only) |

### Convenciones producción
- PK: `UUID` via `gen_random_uuid()`
- Timestamps: `TIMESTAMPTZ` (UTC)
- Soft delete: `deleted_at IS NULL` = activo
- Status: `VARCHAR(20)` con `CHECK` (no ENUM)
- Índices: `idx_{tabla}_{campo}`
- FK: `fk_{origen}_{destino}`

## MongoDB

### Requisitos
- MongoDB 7+
- mongosh

### Ejecución

```bash
# Conectar y ejecutar
mongosh "mongodb://localhost:27017/readuls" bd/mongo/init.js

# Con autenticación
mongosh "mongodb://readuls_app:changeme@localhost:27017/readuls" bd/mongo/init.js
```

### Colecciones creadas

| Colección | Descripción |
|---|---|
| `comments` | Comentarios anidados (Materialized Path) |
| `comment_votes` | Votos en comentarios |

### Estrategia de árbol

Se usa **Hybrid Tree** (Materialized Path + Parent Reference):
- `path`: `/rootId/parentId/selfId/` — árbol completo con 1 query por regex
- `parent_id`: hijos directos con 1 query por filtro exacto
- `depth`: profundidad calculada sin queries adicionales

## Docker Compose (desarrollo local)

```yaml
# Incluido en docker-compose.yml en la raíz del proyecto
postgres:
  image: postgres:16-alpine
mongodb:
  image: mongo:7
redis:
  image: redis:7-alpine
```
