# Readuls — Scripts de Base de Datos

## Estructura

```
bd/
├── postgres/
│   ├── init.sql          ← punto de entrada (llama a los 3 scripts)
│   ├── 01_schema.sql     ← CREATE TABLE en orden de dependencias
│   ├── 02_triggers.sql   ← funciones y triggers (updated_at, contadores, karma)
│   └── 03_indexes.sql    ← índices compuestos de performance
└── mongo/
    ├── init.js           ← punto de entrada
    ├── 01_collections.js ← createCollection con validadores JSON Schema
    └── 02_indexes.js     ← createIndex (incluyendo TTL y unique)
```

## PostgreSQL

### Requisitos
- PostgreSQL 16+
- Extensiones: `pgcrypto`, `pg_trgm`

### Ejecución

```bash
# Opción A — psql directamente
psql -U postgres -d readuls -f bd/postgres/init.sql

# Opción B — script a script
psql -U postgres -d readuls -f bd/postgres/01_schema.sql
psql -U postgres -d readuls -f bd/postgres/02_triggers.sql
psql -U postgres -d readuls -f bd/postgres/03_indexes.sql
```

### Tablas creadas

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

### Convenciones
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
