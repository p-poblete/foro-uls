# HablaLaSalle (Readuls)

**Trabajo Final — Aplicación Full-Stack con OAuth 2.0**
Universidad La Salle

Foro de discusión por hilos, estilo Reddit, para la comunidad de la Universidad
La Salle. Los usuarios inician sesión con su correo institucional vía Auth0, se
organizan en comunidades con distintos niveles de privacidad, publican con
etiquetas (`HELP`, `ANNOUNCEMENT`, `DISCUSSION`, `CASE`) y comentan en hilos
anidados de profundidad arbitraria. Incluye moderación de contenido con
reportes, un panel de moderación completo (rol delegado a Auth0 RBAC) y un
sistema de notificaciones que cubre toda la actividad relevante del foro.

## Resumen funcional (v2.0)

- **Cuentas y perfiles:** login/logout con Google institucional vía Auth0,
  restringido a `@ulasalle.edu.pe`; edición de perfil, avatar, carrera y bio.
- **Comunidades:** creación con privacidad configurable (pública, restringida
  con aprobación, privada), unirse/salir, listado de miembros, edición y
  archivado por el dueño o un moderador.
- **Publicaciones y comentarios:** creación con etiqueta e imagen, votos
  (upvote/downvote), hilos de comentarios anidados sin límite de profundidad,
  edición y borrado por el autor (o un moderador).
- **Reportes y moderación:** cualquier usuario reporta publicaciones o
  comentarios; los moderadores (rol de Auth0) resuelven el reporte —
  **mantener**, **descartar** o **eliminar el contenido** — siempre con un
  motivo que se notifica a los involucrados. El panel de moderación también
  permite suspender/reactivar y archivar comunidades, y desactivar cuentas.
- **Notificaciones:** votos, comentarios, respuestas, nuevas publicaciones y
  anuncios en tus comunidades, y el ciclo completo de un reporte (recibido,
  resuelto, contenido eliminado/editado) — estas últimas son anónimas para
  proteger la identidad de quien reporta.
- **Tema claro/oscuro** con persistencia y sin parpadeo al cargar.

Detalle técnico completo por módulo: [backend/README.md](backend/README.md),
[frontend/README.md](frontend/README.md), [bd/README.md](bd/README.md).

## Integrantes

| Integrante | Correo | Rol |
|------------|--------|-----|
| Leonardo Pachari | lpacharig@ulasalle.edu.pe | Base de datos |
| Nicolle Lozano | nlozanov@ulasalle.edu.pe | Frontend |
| Katherine Saico | ksaicoc@ulasalle.edu.pe | Despliegue / Docker |
| Piero Poblete | ppobletea@ulasalle.edu.pe | Autenticación |
| Elias Manchego | emanchego@ulasalle.edu.pe | Backend |

## Demo en producción

| Componente | URL |
|------------|-----|
| Frontend | <https://foro-uls.readuls.workers.dev> |
| API (backend) | <https://readuls-843408448797.us-central1.run.app> |

> La primera petición al backend puede tardar ~1-3s si el servicio estaba
> inactivo (Cloud Run escala a cero).

## Arquitectura

```
Navegador
   │
   ▼
Frontend (SSR)  ──────────►  Backend (API REST)  ──►  PostgreSQL (Neon)
Cloudflare Workers            Google Cloud Run     ├─►  MongoDB (Atlas)
                                    │              └─►  Cloudflare R2 (imágenes)
                                    ▼
                              Auth0 (OAuth 2.0 / OIDC)
```

| Capa | Tecnología | Hosting |
|------|------------|---------|
| Frontend | TanStack Start (React 19, SSR) + Tailwind + shadcn/ui (Bun) | Cloudflare Workers |
| Backend | Flask (API REST) + SQLAlchemy + PyMongo (gunicorn) | Google Cloud Run |
| Autenticación | Auth0 — OAuth 2.0 Authorization Code + OIDC | Auth0 (SaaS) |
| Base relacional | PostgreSQL | Neon |
| Base NoSQL | MongoDB | MongoDB Atlas |
| Almacenamiento de objetos | Cloudflare R2 (S3-compatible) | Cloudflare |

## Autenticación — OAuth 2.0 con Auth0

La autenticación está **delegada por completo a Auth0** (un Authorization Server
de terceros); el backend actúa solo como cliente OIDC:

1. El usuario pulsa *Iniciar sesión* → el backend redirige a Auth0
   (`/api/auth/login`).
2. Auth0 hospeda el login y el consentimiento; el acceso con Google institucional
   queda detrás de Auth0, restringido a `@ulasalle.edu.pe` mediante una *Action*.
3. Auth0 devuelve un `code` al backend, que lo **intercambia server-to-server**
   por un `access_token` (JWT).
4. En cada petición protegida, el backend **valida el token por JWKS**
   (firma, `aud`, `iss`, `exp`) y resuelve la identidad por el `sub`.
5. Cada usuario solo puede leer/editar lo que le pertenece (ownership por `sub`).

Toda la configuración del proveedor vive en variables de entorno
(`AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`, `AUTH0_AUDIENCE`,
`AUTH0_CALLBACK_URL`); nunca se hardcodea. Ver `backend/.env.example`.

## Bases de datos — por qué dos

- **PostgreSQL (relacional):** usuarios, comunidades, membresías, publicaciones,
  votos y carreras. Son datos estructurados con relaciones e integridad
  referencial (claves foráneas, restricciones de unicidad, *joins*), donde un
  motor relacional es la elección natural.
- **MongoDB (NoSQL):** comentarios (árbol con *materialized path* vía
  `parent_id`, profundidad arbitraria), notificaciones y reportes de contenido.
  Los tres son documentos de alta escritura y forma variable — un hilo, una
  notificación o un reporte no necesitan *joins* ni un esquema rígido, y un
  documento flexible evita el costo de modelarlos en tablas relacionales.

Detalle de colecciones, tablas e índices en [bd/README.md](bd/README.md).

## Estructura del repositorio

```
backend/    API Flask — ver backend/README.md para el detalle de endpoints,
            modelos, autenticación y notificaciones
frontend/   App TanStack Start — ver frontend/README.md para rutas, componentes
            y manejo de estado/auth
bd/         Esquema real (Postgres vía SQLAlchemy) + colecciones Mongo — ver
            bd/README.md
docs/       Documentos de planificación, diseño y guía de despliegue
docker-compose.yml       Orquesta postgres, mongodb, minio, backend y frontend (local)
postman_collection.json  Colección para probar la API (endpoints públicos y protegidos)
```

## Arranque rápido (local, con Docker)

Requisitos: Docker Desktop.

```bash
cp backend/.env.example backend/.env      # completa las variables AUTH0_* y FLASK_SECRET_KEY
cp frontend/.env.example frontend/.env
docker compose up -d --build
```

- Frontend → <http://localhost:8080>
- Backend → <http://localhost:5000>
- Consola MinIO → <http://localhost:9001>

Para el login en local, añade `http://localhost:5000/oauth/callback` a las
*Allowed Callback URLs* de tu aplicación en Auth0.

## Probar la API (Postman)

Importa `postman_collection.json`. Trae endpoints **públicos** y **protegidos**
(con `Authorization: Bearer <token>`), incluyendo casos de error `401`/`403`.

- La variable `base_url` ya apunta al backend en producción.
- Para `token`: inicia sesión en la app y copia el valor de `auth_token` desde
  el *localStorage* del navegador (DevTools → Application → Local Storage).

## Despliegue

La aplicación corre sobre tiers gratuitos: Cloudflare (frontend), Google Cloud
Run (backend), Neon (PostgreSQL), MongoDB Atlas (MongoDB), Cloudflare R2
(imágenes) y Auth0 (autenticación). La guía completa paso a paso está en
[docs/DEPLOY.md](docs/DEPLOY.md).

## Configuración

Las variables van en `backend/.env` y `frontend/.env` (ambos ignorados por git).
Usa los archivos `.env.example` como plantilla. **Nunca subas credenciales reales
al repositorio.**
