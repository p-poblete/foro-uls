# Ejecutar en modo desarrollo

Dos formas: **todo en Docker** (recomendada, más fácil de levantar/detener) o
**nativa** (Postgres/Mongo en Docker; backend y frontend a mano).

## Requisitos
- Docker Desktop. (Para el modo nativo además: Python 3.13 y Bun.)

## Opción A — Todo en contenedores (recomendada)

Cuatro servicios independientes en `docker-compose.yml`: `postgres`, `mongodb`,
`backend`, `frontend`. Cada uno se levanta y detiene por separado.

```bash
docker compose up -d                 # levanta los 4 (build la primera vez)
docker compose up -d --build backend # reconstruye y reinicia solo el backend
docker compose stop frontend         # detiene solo el frontend
docker compose start frontend        # lo vuelve a levantar
docker compose logs -f backend       # ver logs de un servicio
docker compose down                  # detiene todo (agrega -v para borrar datos)
```

- Frontend → http://localhost:8080 · Backend → http://localhost:5000
- El backend siembra datos (idempotente) al arrancar y espera a que Postgres
  esté sano (`depends_on: service_healthy`).
- Config: el backend toma OAuth/`FLASK_SECRET_KEY` de `backend/.env`, pero las
  URLs de BD se sobreescriben en el compose para apuntar a los contenedores
  (`postgres`, `mongodb`). El navegador sigue hablando con `localhost:5000`.

> Nota: tras cambiar código, reconstruye ese servicio (`--build`). El frontend
> corre Vite en modo dev dentro del contenedor.

## Opción B — Nativa (solo las BD en Docker)

### 1. Solo las bases de datos (Postgres + Mongo)
Desde la raíz del repo:
```bash
docker compose up -d postgres mongodb
```
Postgres → `localhost:5435`, Mongo → `localhost:27017`. Datos persisten en
volúmenes. Para apagar: `docker compose down` (agrega `-v` para borrar datos).

### 2. Backend (http://localhost:5000)
```bash
pip install -r backend/requirements.txt   # solo la primera vez
python backend/seed.py                     # datos de demo (idempotente)
python backend/app.py
```
`app.py` crea las tablas con `db.create_all()` al arrancar. El `seed.py` crea
un usuario, dos comunidades, publicaciones y un comentario.

### 3. Frontend (http://localhost:8080)
```bash
cd frontend
bun install    # solo la primera vez
bun dev
```

Abre **http://localhost:8080**. El login con Google usa el backend en `:5000`.

## Configuración
- `backend/.env` → credenciales OAuth, `FLASK_SECRET_KEY` (clave dev estable),
  `POSTGRES_URL`, `MONGO_URL`, `FRONTEND_URL=http://localhost:8080`.
- `frontend/.env` → `VITE_API_BASE_URL=http://localhost:5000`.

## Estado de integración
**Todo el frontend lee de la BD real — `mock-data.ts` fue eliminado.**
Las vistas consumen la API vía `src/lib/api.ts` (adaptadores backend→dominio)
con TanStack Query. Verificado end-to-end:
- Auth: login con Google (OAuth) y login de desarrollo por correo, contra Postgres.
- Lecturas: feed, comunidades, detalle de publicación/comunidad, perfiles,
  búsqueda, carreras, notificaciones (todas desde la BD).
- Escrituras: crear publicación, comentar, crear comunidad, editar publicación,
  registro y edición de perfil.

**Solo en `localStorage` (por diseño, no requieren backend):** guardados
(bookmarks), borradores, reportes y estado de "leído" de notificaciones.

**Notas de alcance del backend:** `member_count`/`is_member` (sin tabla de
membresías) y `comment_count` por comentario no persisten roles; los
"miembros" de una comunidad se listan desde `/api/users`; no hay endpoint de
"comentarios por usuario" ni sistema de notificaciones (devuelve lista vacía).

## Verificación rápida
```bash
curl http://localhost:5000/api/posts        # feed con datos del seed
curl http://localhost:5000/api/communities
```
