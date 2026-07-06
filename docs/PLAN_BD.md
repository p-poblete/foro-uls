# Plan Base de Datos — Unificación v1

## Estado actual

- `backend/models.py`: esquema ORM operativo con integer PKs, pero **incompleto** (sin `external_auth_id`, sin careers, sin community_members).
- `bd/postgres/01_schema.sql`: esquema de producción objetivo con UUID PKs, más completo, pero **no sincronizado** con el ORM actual.
- `bd/mongo/`: colecciones `comments` y `comment_votes` definidas con validadores, aún no inicializadas formalmente.
- No existe script de seed de datos.
- Divergencia intencional entre el ORM (v1 simple) y el SQL de producción (diseño final): **para v1 se trabaja sobre el ORM con integer PKs**, la migración a UUIDs queda para una iteración posterior.

---

## Decisión de arquitectura

| Aspecto | v1 (este plan) | Futuro |
|---|---|---|
| PKs | Integer auto-increment | UUID (ya definido en `bd/postgres/`) |
| Auth | **Auth0 OAuth 2.0** — la contraseña nunca llega a la BD | Sin cambios previstos |
| Migraciones | `db.create_all()` manual | Flask-Migrate / Alembic |
| Sharding / réplicas | No | Según crecimiento |

---

## PostgreSQL

### P-1 — Tabla `careers`

```sql
CREATE TABLE IF NOT EXISTS careers (
  id   SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  code VARCHAR(20)  NOT NULL UNIQUE
);
```

Seed inmediato con las 8 carreras de ULS:
```sql
INSERT INTO careers (name, code) VALUES
  ('Arquitectura y Urbanismo',              'arq'),
  ('Ingeniería Industrial',                 'ind'),
  ('Psicología',                            'psi'),
  ('Derecho',                               'der'),
  ('Administración y Negocios Internacionales', 'adm'),
  ('Ingeniería de Software',               'sft'),
  ('Ciencias de la Comunicación',          'com'),
  ('Ingeniería Comercial',                 'cml')
ON CONFLICT (code) DO NOTHING;
```

### P-2 — Alteraciones en `users`

Con Auth0, la contraseña nunca se almacena. El identificador del usuario en Auth0 es el `sub` del JWT (ej. `google-oauth2|1234567890`), que se guarda en `external_auth_id`. Este campo es lo que el backend usa para buscar o crear el usuario local en el primer login.

```sql
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS external_auth_id  VARCHAR(200) UNIQUE,
  ADD COLUMN IF NOT EXISTS auth_provider     VARCHAR(50)  DEFAULT 'auth0',
  ADD COLUMN IF NOT EXISTS gender            VARCHAR(20),
  ADD COLUMN IF NOT EXISTS career_id         INTEGER REFERENCES careers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS profile_image     TEXT,
  ADD COLUMN IF NOT EXISTS cover_image       TEXT;

-- Renombrar avatar_url → profile_image si ya existe la columna
-- ALTER TABLE users RENAME COLUMN avatar_url TO profile_image;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_external_auth_id
  ON users(external_auth_id) WHERE external_auth_id IS NOT NULL;
```

`email` ya existe en el modelo actual y se conserva — Auth0 lo entrega en el token y es útil para queries.

### P-3 — Tabla `community_members`

```sql
CREATE TABLE IF NOT EXISTS community_members (
  id           SERIAL PRIMARY KEY,
  community_id INTEGER NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  user_id      INTEGER NOT NULL REFERENCES users(id)       ON DELETE CASCADE,
  role         VARCHAR(20) NOT NULL DEFAULT 'member'
               CHECK (role IN ('member', 'moderator', 'admin')),
  joined_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_community_members UNIQUE (community_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_cm_community ON community_members(community_id);
CREATE INDEX IF NOT EXISTS idx_cm_user      ON community_members(user_id);
```

### P-4 — Alteraciones en `communities`

```sql
ALTER TABLE communities
  ADD COLUMN IF NOT EXISTS profile_image VARCHAR(500),
  ADD COLUMN IF NOT EXISTS cover_image   VARCHAR(500),
  ADD COLUMN IF NOT EXISTS member_count  INTEGER NOT NULL DEFAULT 0;
```

### P-5 — Alteraciones en `posts`

```sql
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS comment_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS label         VARCHAR(20)
                           CHECK (label IN ('HELP', 'ANNOUNCEMENT', 'DISCUSSION', 'CASE')),
  ADD COLUMN IF NOT EXISTS tags          TEXT[];   -- array de strings simple para v1
```

`comment_count` se mantiene desnormalizado: el backend lo incrementa/decrementa al crear/eliminar comentarios en MongoDB.

### P-6 — Índices adicionales para v1

```sql
-- Búsqueda básica en posts
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_posts_label      ON posts(label)           WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_posts_author_id  ON posts(author_id)       WHERE deleted_at IS NULL;
```

### P-7 — Seed de usuario demo

Con Auth0 no se crean usuarios manualmente con password. El usuario demo se crea la primera vez que alguien inicia sesión con Google: el backend recibe el JWT de Auth0, extrae el `sub`, y si no existe en la tabla lo inserta automáticamente.

Para poder tener datos de prueba antes de que haya usuarios reales, el seed solo inserta un registro de referencia con `external_auth_id` ficticio (útil para asociar posts/comunidades en desarrollo):

```sql
INSERT INTO users (username, email, display_name, external_auth_id, auth_provider, gender, career_id, status)
VALUES (
  'admin_uls',
  'admin@ulasalle.edu.pe',
  'Admin ULS',
  'google-oauth2|000000000000000000000',
  'auth0',
  'NON_BINARY',
  (SELECT id FROM careers WHERE code = 'sft'),
  'active'
)
ON CONFLICT (username) DO NOTHING;
```

### P-8 — Script de inicialización completo para v1

Crear `bd/postgres/v1_init.sql` que ejecute en orden:
```
01_schema.sql  (tablas base existentes)
v1_careers.sql (P-1)
v1_users.sql   (P-2)
v1_communities.sql (P-3 + P-4)
v1_posts.sql   (P-5)
v1_indexes.sql (P-6)
v1_seed.sql    (P-7 + carreras)
```

Comando de uso:
```bash
psql -U readuls -d readuls -f bd/postgres/v1_init.sql
```

---

## MongoDB

### M-1 — Inicializar colecciones formalmente

El backend inicializa MongoDB en `database.py:init_mongo()` creando solo 2 índices básicos. Falta ejecutar los scripts en `bd/mongo/`:

```bash
mongosh readuls < bd/mongo/01_collections.js   # crea colecciones con validadores
mongosh readuls < bd/mongo/02_indexes.js        # crea índices
```

Esto debe hacerse **una sola vez** al levantar el entorno por primera vez.

### M-2 — Completar `init_mongo()` para v1

Actualizar `backend/database.py` para crear todos los índices que necesita v1:

```python
def init_mongo(app):
    global _mongo_db
    client = MongoClient(app.config["MONGO_URL"])
    _mongo_db = client[app.config["MONGO_DB"]]

    # comments
    _mongo_db.comments.create_index([("post_id", 1), ("parent_id", 1)])
    _mongo_db.comments.create_index([("post_id", 1), ("created_at", -1)])
    _mongo_db.comments.create_index([("author_id", 1)])

    # comment_votes — unicidad por (comment_id, user_id)
    _mongo_db.comment_votes.create_index(
        [("comment_id", 1), ("user_id", 1)], unique=True
    )
```

### M-3 — Ajustar el modelo de comentario para v1

El documento de comentario que el backend guarda actualmente no incluye `community_id` ni el `author_snapshot`. Para v1 agregar al momento de insertar:

```python
comment = {
    "post_id":      post_id,
    "community_id": community_id,   # para filtros futuros
    "author_id":    author_id,
    "author_snapshot": {            # desnormalizado para no hacer join al leer
        "username":      user.username,
        "profile_image": user.profile_image,
    },
    "parent_id":  parent_id,
    "depth":      depth,
    "content":    data["content"],
    "vote_score": 0,
    "status":     "active",
    "created_at": now,
    "updated_at": now,
    "deleted_at": None,
}
```

### M-4 — Votos de comentarios con unicidad

Actualmente el endpoint `POST /api/comments/<id>/vote` hace `$inc` directo sin verificar si el usuario ya votó. Implementar con `comment_votes`:

1. Buscar en `comment_votes` si existe `{ comment_id, user_id }`.
2. Si existe: ajustar el delta (cambio de voto) y actualizar.
3. Si no existe: insertar y aplicar `$inc` al comentario.

---

## Variables de entorno requeridas

Agregar a `backend/.env` (crear si no existe):
```
POSTGRES_URL=postgresql://readuls:readuls123@localhost:5435/readuls
MONGO_URL=mongodb://localhost:27017
MONGO_DB=readuls
AUTH0_DOMAIN=<tu-tenant>.auth0.com
AUTH0_AUDIENCE=https://readuls-api          # el identificador de la API registrada en Auth0
AWS_ACCESS_KEY_ID=<opcional-para-subir-imágenes>
AWS_SECRET_ACCESS_KEY=<opcional>
AWS_S3_BUCKET=<opcional>
AWS_S3_REGION=<opcional>
```

`JWT_SECRET_KEY` ya no es necesario: el backend verifica los tokens con la clave pública de Auth0 (JWKS), no con un secreto propio.

---

## Orden de ejecución

```
1. Crear y ejecutar v1_init.sql (tablas + seed)
2. Ejecutar bd/mongo/01_collections.js y 02_indexes.js
3. Actualizar init_mongo() en database.py
4. Aplicar alteraciones al ORM en models.py (sincronizar con las tablas)
5. Ajustar documento de comentario (M-3)
6. Implementar unicidad de votos en comentarios (M-4)
```
