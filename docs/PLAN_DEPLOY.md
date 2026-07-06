# Plan Deploy — Primera versión palpable

## Objetivo

Tener el sistema accesible en una URL pública para revisión del equipo y entrega académica, con los tres componentes corriendo de forma coordinada: frontend, backend y bases de datos.

---

## Arquitectura de deploy v1

```
┌──────────────────────────────────────────────────────┐
│  Internet                                            │
│                                                      │
│  ┌──────────────┐   ┌──────────┐   ┌─────────────┐  │
│  │   Frontend   │──▶│  Auth0   │   │   Backend   │  │
│  │  (Vercel /   │   │ (OAuth)  │   │  (Render /  │  │
│  │  Netlify)    │   └──────────┘   │  Railway)   │  │
│  └──────┬───────┘                  └──────┬──────┘  │
│         │   Bearer token (JWT Auth0)       │         │
│         └────────────────────────────────▶│         │
│                                           │         │
│                          ┌────────────────┴──────┐  │
│                          │                       │  │
│               ┌──────────▼───┐  ┌────────────┐   │  │
│               │  PostgreSQL  │  │  MongoDB   │   │  │
│               │ (Neon /      │  │  (Atlas    │   │  │
│               │  Supabase)   │  │   free)    │   │  │
│               └──────────────┘  └────────────┘   │  │
└──────────────────────────────────────────────────────┘
```

Todas las opciones mencionadas tienen tier gratuito suficiente para un proyecto académico.

---

## Auth0 (configurar antes que el backend y el frontend)

Auth0 es el único servicio que requiere configuración manual en su panel antes de poder escribir código.

### Crear la aplicación en Auth0

1. Crear cuenta en [auth0.com](https://auth0.com) → nuevo **Tenant** (ej. `readuls`).
2. En **Applications** → **Create Application** → tipo **Single Page Application** (para el frontend React).
   - **Allowed Callback URLs**: `http://localhost:5173, https://<tu-app>.vercel.app`
   - **Allowed Logout URLs**: `http://localhost:5173, https://<tu-app>.vercel.app`
   - **Allowed Web Origins**: `http://localhost:5173, https://<tu-app>.vercel.app`
   - Anotar: `Domain` y `Client ID`.
3. En **APIs** → **Create API**:
   - **Name**: `Readuls API`
   - **Identifier** (audience): `https://readuls-api`
   - Este identificador es el que va en `VITE_AUTH0_AUDIENCE` y `AUTH0_AUDIENCE`.
4. En **Authentication** → **Social** → activar **Google** (requiere Google OAuth credentials o usar las de dev de Auth0).

### Configurar Google como proveedor
Para desarrollo: Auth0 provee credenciales de Google compartidas que funcionan sin configuración adicional.  
Para producción: crear un proyecto en [Google Cloud Console](https://console.cloud.google.com), generar un OAuth 2.0 Client ID, y pegarlo en Auth0.

---

## Bases de datos (configurar antes que backend y frontend)

### PostgreSQL — Opción recomendada: Neon

1. Crear cuenta en [neon.tech](https://neon.tech) → nuevo proyecto → copiar `DATABASE_URL`.
2. Ejecutar el script de inicialización:
   ```bash
   psql "<DATABASE_URL>" -f bd/postgres/v1_init.sql
   ```
3. Guardar la URL como variable de entorno para el backend: `POSTGRES_URL`.

Alternativa igualmente válida: **Supabase** (incluye UI de administración).

### MongoDB — Atlas

1. Crear cuenta en [mongodb.com/atlas](https://www.mongodb.com/atlas) → cluster M0 (gratuito).
2. Crear base de datos `readuls`.
3. En "Network Access" agregar `0.0.0.0/0` (acceso desde cualquier IP, suficiente para v1).
4. Copiar el connection string: `mongodb+srv://user:pass@cluster.mongodb.net/readuls`.
5. Ejecutar los scripts de colecciones desde la terminal local apuntando al cluster:
   ```bash
   mongosh "mongodb+srv://..." < bd/mongo/01_collections.js
   mongosh "mongodb+srv://..." < bd/mongo/02_indexes.js
   ```
6. Guardar como `MONGO_URL` y `MONGO_DB=readuls` para el backend.

---

## Backend — Render (Web Service)

### Preparación del repositorio

1. Crear `backend/Procfile` (o `render.yaml`):
   ```
   web: python app.py
   ```
   O mejor, usar Gunicorn para producción:
   ```
   web: gunicorn app:create_app() --bind 0.0.0.0:$PORT
   ```
   Agregar `gunicorn>=21.0.0` a `requirements.txt`.

2. El entry point de Flask debe respetar el puerto de la variable de entorno:
   ```python
   if __name__ == "__main__":
       port = int(os.getenv("PORT", 5000))
       app.run(host="0.0.0.0", port=port)
   ```

3. Crear `backend/runtime.txt`:
   ```
   python-3.13.0
   ```

### Deploy en Render

1. Nuevo "Web Service" → conectar el repositorio de GitHub.
2. **Root Directory**: `backend`
3. **Build Command**: `pip install -r requirements.txt`
4. **Start Command**: `gunicorn "app:create_app()" --bind 0.0.0.0:$PORT`
5. Agregar variables de entorno en el panel de Render:

   | Variable | Valor |
   |---|---|
   | `POSTGRES_URL` | URL de Neon / Supabase |
   | `MONGO_URL` | URL de Atlas |
   | `MONGO_DB` | `readuls` |
   | `AUTH0_DOMAIN` | `<tu-tenant>.auth0.com` |
   | `AUTH0_AUDIENCE` | `https://readuls-api` |
   | `AWS_ACCESS_KEY_ID` | (opcional, para imágenes) |
   | `AWS_SECRET_ACCESS_KEY` | (opcional) |
   | `AWS_S3_BUCKET` | (opcional) |
   | `AWS_S3_REGION` | (opcional) |

6. Anotar la URL pública que genera Render: `https://readuls-api.onrender.com`.

### CORS en producción
Actualizar `app.py` para permitir el dominio del frontend desplegado:
```python
CORS(app, resources={r"/api/*": {"origins": [
    "http://localhost:5173",
    "https://<tu-app>.vercel.app",
]}})
```

---

## Frontend — Vercel

### Preparación

1. Asegurarse de que `frontend/package.json` tiene el script `build`:
   ```json
   "build": "vite build"
   ```

2. Crear `frontend/.env.production` (no se sube al repositorio):
   ```
   VITE_API_BASE_URL=https://readuls-api.onrender.com
   VITE_APP_NAME=HablaLaSalle
   ```

### Deploy en Vercel

1. Importar el repositorio en [vercel.com](https://vercel.com).
2. Configurar:
   - **Framework Preset**: Vite
   - **Root Directory**: `frontend`
   - **Build Command**: `bun run build`
   - **Output Directory**: `dist`
3. Agregar variables de entorno en el panel de Vercel:

   | Variable | Valor |
   |---|---|
   | `VITE_API_BASE_URL` | URL del backend en Render |
   | `VITE_APP_NAME` | `HablaLaSalle` |
   | `VITE_AUTH0_DOMAIN` | `<tu-tenant>.auth0.com` |
   | `VITE_AUTH0_CLIENT_ID` | Client ID de la SPA en Auth0 |
   | `VITE_AUTH0_AUDIENCE` | `https://readuls-api` |

4. Vercel asigna una URL del tipo `https://foro-uls.vercel.app`.

Alternativa: **Netlify** (proceso idéntico, mismas variables).

---

## Variables de entorno — resumen completo

### `backend/.env` (desarrollo local)
```
POSTGRES_URL=postgresql://readuls:readuls123@localhost:5435/readuls
MONGO_URL=mongodb://localhost:27017
MONGO_DB=readuls
AUTH0_DOMAIN=<tu-tenant>.auth0.com
AUTH0_AUDIENCE=https://readuls-api
PORT=5000
```

### `frontend/.env` (desarrollo local)
```
VITE_API_BASE_URL=http://localhost:5000
VITE_APP_NAME=HablaLaSalle
VITE_AUTH0_DOMAIN=<tu-tenant>.auth0.com
VITE_AUTH0_CLIENT_ID=<client-id>
VITE_AUTH0_AUDIENCE=https://readuls-api
```

Ninguno de estos archivos se sube al repositorio. Agregar ambos a `.gitignore`:
```
backend/.env
frontend/.env
frontend/.env.production
```

---

## Verificación post-deploy

Una vez desplegados los tres componentes, validar en orden:

1. **BD**: conectar con un cliente (DBeaver / Compass) y verificar que las tablas y colecciones existen con los datos seed.
2. **Backend health check**: `GET https://readuls-api.onrender.com/` debe devolver `{"status": "ok", "app": "Readuls API v1"}`.
3. **Auth**: iniciar sesión con Google desde el frontend desplegado → Auth0 redirige de vuelta → verificar que el usuario aparece en la tabla `users` de PostgreSQL con su `external_auth_id`.
4. **Lectura**: ver el feed, entrar a una comunidad, ver un post con comentarios.
5. **Escritura**: crear una publicación, escribir un comentario, votar.

---

## Consideraciones para iteraciones futuras

- **Dominio personalizado**: Vercel y Render permiten agregar un dominio propio sin costo.
- **CI/CD**: conectar las ramas `main` y `dev` a deploys automáticos en Vercel/Render.
- **Migraciones de BD**: cuando se pase de integer PKs a UUIDs, usar Flask-Migrate (Alembic) en lugar de `db.create_all()`.
- **Secretos**: mover credenciales Auth0 y AWS a un gestor de secretos (Render Secret Files, Vercel Encrypted Env Vars).
- **Google OAuth en producción**: reemplazar las credenciales de dev de Auth0 por un OAuth Client ID propio de Google Cloud Console para evitar restricciones de cuota.
- **Render free tier**: los servicios gratuitos de Render entran en modo sleep tras 15 minutos de inactividad; el primer request puede tardar ~30s. Para v1 académico es aceptable.
