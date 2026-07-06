# Despliegue en producción (gratis)

Guía para poner HablaLaSalle en línea usando solo tiers gratuitos y durables.
El orden importa: primero datos + almacenamiento, luego backend, luego frontend,
y al final actualizar el OAuth de Google con las URLs reales.

## Plataformas

| Componente         | Plataforma            | Notas |
|--------------------|-----------------------|-------|
| Frontend (SSR)     | Cloudflare Workers    | El build ya emite `.output/server/wrangler.json`. |
| Backend (Flask)    | Koyeb (Free Web)      | Construye `backend/Dockerfile` (gunicorn). |
| PostgreSQL         | Neon                  | `?sslmode=require` en la URL. |
| MongoDB            | MongoDB Atlas (M0)    | Cadena SRV. |
| Imágenes           | Cloudflare R2         | S3-compatible; `storage.py` ya lo soporta. |

Todas las variables están documentadas en `backend/.env.example` y
`frontend/.env.example`. Abajo solo se listan los valores que cambian en prod.

---

## 1. PostgreSQL — Neon

1. Crea un proyecto en <https://neon.tech> (región más cercana, ej. `aws-us-east`).
2. Copia la *connection string* (formato
   `postgresql://user:pass@ep-xxx.neon.tech/readuls?sslmode=require`).
3. Guárdala para `POSTGRES_URL` del backend.

## 2. MongoDB — Atlas M0

1. Crea un cluster **M0 (Free)** en <https://cloud.mongodb.com>.
2. En *Network Access* añade `0.0.0.0/0` (Koyeb no da IP fija).
3. En *Database Access* crea un usuario y copia la cadena SRV
   (`mongodb+srv://user:pass@cluster.xxx.mongodb.net`).
4. Guárdala para `MONGO_URL`. `MONGO_DB=readuls`.

## 3. Imágenes — Cloudflare R2

1. En el dashboard de Cloudflare → **R2** → crea un bucket llamado `readuls`.
2. Bucket → *Settings* → **Public access**: activa el dominio `r2.dev`
   (o conecta un dominio propio). Copia la URL pública `https://pub-xxxx.r2.dev`.
3. R2 → *Manage API Tokens* → crea un token con permiso *Object Read & Write*.
   Copia *Access Key ID*, *Secret Access Key* y el endpoint S3
   `https://<account_id>.r2.cloudflarestorage.com`.

Variables resultantes (backend):

```
AWS_ACCESS_KEY_ID=<r2 access key>
AWS_SECRET_ACCESS_KEY=<r2 secret>
AWS_S3_BUCKET=readuls
AWS_S3_REGION=auto
AWS_S3_ENDPOINT=https://<account_id>.r2.cloudflarestorage.com
AWS_S3_PUBLIC_URL=https://pub-xxxx.r2.dev
```

> `AWS_S3_PUBLIC_URL` **no** lleva el nombre del bucket: en R2 el dominio público
> ya está ligado al bucket. La URL final se arma como `AWS_S3_PUBLIC_URL/<key>`.

## 4. Backend — Koyeb

1. <https://app.koyeb.com> → **Create Web Service** → *GitHub* → este repo.
2. Builder: **Dockerfile**. *Work directory* / contexto: `backend`
   (Dockerfile: `backend/Dockerfile`).
3. *Ports*: expón el puerto que Koyeb inyecta en `$PORT` (por defecto 8000);
   el Dockerfile hace `--bind 0.0.0.0:$PORT`. Health check: `/` (ya responde `ok`).
4. *Environment variables* (marca como *Secret* las sensibles):

   ```
   POSTGRES_URL=postgresql://...neon.tech/readuls?sslmode=require
   MONGO_URL=mongodb+srv://...mongodb.net
   MONGO_DB=readuls
   FLASK_SECRET_KEY=<python -c "import secrets;print(secrets.token_hex(32))">
   ALLOWED_EMAIL_DOMAIN=ulasalle.edu.pe
   GOOGLE_CLIENT_ID=<...>
   GOOGLE_CLIENT_SECRET=<...>
   GOOGLE_REDIRECT_URI=https://<tu-backend>.koyeb.app/oauth/callback
   FRONTEND_URL=https://<tu-frontend>.workers.dev
   # + las 6 variables AWS_S3_* del paso 3
   ```

   `GOOGLE_REDIRECT_URI` y `FRONTEND_URL` necesitan las URLs finales: puedes
   desplegar primero con valores provisionales y actualizarlos al terminar.
5. Deploy. El contenedor corre `seed.py` (idempotente) y luego gunicorn.
   Anota la URL pública, ej. `https://readuls-xxx.koyeb.app`.

## 5. Frontend — Cloudflare Workers

`VITE_API_BASE_URL` se **hornea en el build**, así que debe apuntar al backend
antes de compilar.

**Opción A — deploy manual (Wrangler CLI):**

```bash
cd frontend
echo 'VITE_API_BASE_URL=https://<tu-backend>.koyeb.app' >  .env
echo 'VITE_APP_NAME=HablaLaSalle'                        >> .env
bun install
bunx wrangler login      # una vez
bun run deploy           # vite build + wrangler deploy
```

Anota la URL, ej. `https://tanstack-start-ts.<subdominio>.workers.dev`.

**Opción B — Git integration (Cloudflare dashboard):** conecta el repo, *root
directory* `frontend`, build command `bun run build`, y define
`VITE_API_BASE_URL` / `VITE_APP_NAME` como variables de build.

## 6. Google OAuth (paso final)

En <https://console.cloud.google.com/apis/credentials> → tu cliente OAuth:

- **Authorized redirect URIs**: `https://<tu-backend>.koyeb.app/oauth/callback`
- **Authorized JavaScript origins**: `https://<tu-frontend>.workers.dev`

Luego actualiza en Koyeb `GOOGLE_REDIRECT_URI` y `FRONTEND_URL` con las URLs
finales si usaste provisionales, y redeploy el backend.

---

## Verificación

1. `GET https://<backend>/` → `{"status":"ok","app":"Readuls API v1"}`.
2. Abre el frontend → *Login con Google* → debe volver autenticado.
3. Crea un post con imagen → la imagen debe servirse desde `pub-xxxx.r2.dev`.

## Notas

- Koyeb Free puede dormir tras inactividad → primera petición con arranque frío.
- Cambiar `VITE_API_BASE_URL` requiere **recompilar** el frontend, no solo
  reiniciar.
- El `docker-compose.yml` sigue siendo para desarrollo local; producción no lo usa.
