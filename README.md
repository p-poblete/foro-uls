# HablaLaSalle (Readuls)

Foro de discusión por hilos, estilo Reddit, para la Universidad La Salle (ULS).
Los usuarios se organizan en comunidades, publican con etiquetas (HELP,
ANNOUNCEMENT, DISCUSSION, CASE) y comentan en hilos anidados.

## Stack

- **Frontend:** TanStack Start (React 19 SSR) + Tailwind + shadcn/ui, con Bun.
- **Backend:** Flask (API REST) con SQLAlchemy y PyMongo.
- **Datos:** PostgreSQL (usuarios, comunidades, posts, votos) + MongoDB
  (comentarios, con *materialized path* para los hilos).
- **Almacenamiento:** MinIO (S3-compatible, autohospedado) para imágenes.
- **Auth:** OAuth con Google, restringido al dominio `@ulasalle.edu.pe`.

## Arranque rápido (todo en Docker)

Requisitos: Docker Desktop.

```bash
cp backend/.env.example backend/.env      # completa GOOGLE_CLIENT_ID/SECRET y FLASK_SECRET_KEY
cp frontend/.env.example frontend/.env
docker compose up -d --build
```

- Frontend → http://localhost:8080
- Backend → http://localhost:5000
- Consola MinIO → http://localhost:9001

Para el modo nativo (backend/frontend a mano) y más detalle, ver
[DESARROLLO.md](docs/DESARROLLO.md). Para publicarlo en línea (Cloudflare + Koyeb +
Neon + Atlas + R2, todo gratis), ver [DEPLOY.md](docs/DEPLOY.md).

## Estructura

```
backend/    API Flask (rutas en backend/routes/, modelos, storage MinIO, seed)
frontend/   App TanStack Start (código en frontend/src/)
bd/         Diseño de esquema SQL/Mongo de referencia (no ejecutado por el backend)
docs/       Documentos de planificación y diseño
docker-compose.yml   Orquesta postgres, mongodb, minio, backend y frontend
```

## Configuración

Las variables van en `backend/.env` y `frontend/.env` (ambos ignorados por git).
Usa los archivos `.env.example` como plantilla. **Nunca subas credenciales reales
al repositorio.**
