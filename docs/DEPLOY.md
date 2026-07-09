# Despliegue en producción

Guía para poner HablaLaSalle en línea. El orden importa: primero datos +
almacenamiento, luego el backend (Cloud Run), luego el frontend (Cloudflare), y
al final la autenticación con Auth0 usando las URLs reales.

## Plataformas

| Componente         | Plataforma            | Notas |
|--------------------|-----------------------|-------|
| Frontend (SSR)     | Cloudflare Workers    | Deploy por `wrangler` desde la terminal. |
| Backend (Flask)    | **Google Cloud Run**  | Deploy por `gcloud run deploy --source`; construye `backend/Dockerfile` (gunicorn). |
| PostgreSQL         | Neon                  | `?sslmode=require` en la URL. |
| MongoDB            | MongoDB Atlas (M0)    | Cadena SRV. |
| Imágenes           | Cloudflare R2         | S3-compatible; `storage.py` ya lo soporta. |
| **Auth**           | **Auth0**             | Authorization Server (OAuth 2.0 Authorization Code + OIDC). |

Todas las variables están en `backend/.env.example`. Abajo solo los valores que cambian en prod.

---

## 1. PostgreSQL — Neon

1. Crea un proyecto en <https://neon.tech>.
2. Copia la *connection string* (`postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require`).
3. Guárdala para `POSTGRES_URL`.

## 2. MongoDB — Atlas M0

1. Crea un cluster **M0 (Free)** en <https://cloud.mongodb.com>.
2. En *Network Access* añade `0.0.0.0/0` (Cloud Run no tiene IP saliente fija).
3. En *Database Access* crea un usuario y copia la cadena SRV.
4. Guárdala para `MONGO_URL`. `MONGO_DB=readuls`.

## 3. Imágenes — Cloudflare R2

1. Cloudflare → **R2** → crea un bucket `readuls`.
2. Bucket → *Settings* → **Public access**: activa el dominio `r2.dev`. Copia `https://pub-xxxx.r2.dev`.
3. R2 → *Manage API Tokens* → token *Object Read & Write*. Copia *Access Key ID*, *Secret Access Key* y el endpoint `https://<account_id>.r2.cloudflarestorage.com`.

```
AWS_ACCESS_KEY_ID=<r2 access key>
AWS_SECRET_ACCESS_KEY=<r2 secret>
AWS_S3_BUCKET=readuls
AWS_S3_REGION=auto
AWS_S3_ENDPOINT=https://<account_id>.r2.cloudflarestorage.com
AWS_S3_PUBLIC_URL=https://pub-xxxx.r2.dev
```

> `AWS_S3_PUBLIC_URL` **no** lleva el bucket: en R2 el dominio público ya está
> ligado al bucket. La URL final se arma como `AWS_S3_PUBLIC_URL/<key>`.

## 4. Backend — Google Cloud Run

Free tier real (escala a cero; cold start ~1-3s). Requiere cuenta con facturación
(tarjeta), pero a esta escala factura **$0**.

**Setup (una vez):**
1. Crea un proyecto en <https://console.cloud.google.com> y activa **Billing**.
2. Instala la CLI (<https://cloud.google.com/sdk>), luego:
   ```
   gcloud auth login
   gcloud config set project TU_PROJECT_ID
   gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
   ```
3. La primera vez, da permiso de build a la service account por defecto:
   ```
   gcloud projects add-iam-policy-binding TU_PROJECT_ID \
     --member=serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com \
     --role=roles/cloudbuild.builds.builder --condition=None
   ```

**Deploy:** las variables se pasan con un `env.yaml` (fuera del repo, con todos los
valores: DB, R2, Flask, Auth0). Desde la raíz del repo:
```
gcloud run deploy readuls --source backend --region us-central1 \
  --allow-unauthenticated --env-vars-file env.yaml
```
- `--allow-unauthenticated`: la API es pública en la red; la auth real la hace la
  app con Auth0. Sin esto el endpoint sería inalcanzable.
- Cloud Run inyecta `$PORT=8080`; el Dockerfile hace `--bind 0.0.0.0:$PORT`.
- Anota la **Service URL** (ej. `https://readuls-xxxxx.us-central1.run.app`).

Para actualizar solo variables (sin rebuild): `gcloud run services update readuls
--region us-central1 --env-vars-file env.yaml`.

Variables del backend (`env.yaml`):
```
POSTGRES_URL=...           MONGO_URL=...            MONGO_DB=readuls
FLASK_SECRET_KEY=...       ALLOWED_EMAIL_DOMAIN=ulasalle.edu.pe
FRONTEND_URL=https://<tu-frontend>.workers.dev
AUTH0_DOMAIN=...           AUTH0_CLIENT_ID=...      AUTH0_CLIENT_SECRET=...
AUTH0_AUDIENCE=https://readuls-api
AUTH0_CALLBACK_URL=https://<tu-backend>.run.app/oauth/callback
# + las 6 variables AWS_S3_* del paso 3
```

## 5. Frontend — Cloudflare Workers

`VITE_API_BASE_URL` se **hornea en el build**, así que apunta al backend antes de compilar.

```bash
cd frontend
echo 'VITE_API_BASE_URL=https://<tu-backend>.run.app' >  .env
echo 'VITE_APP_NAME=HablaLaSalle'                      >> .env
bun install
bunx wrangler login          # una vez
bun run build
bunx wrangler deploy -c .output/server/wrangler.json --name foro-uls
```
Anota la URL (ej. `https://foro-uls.<subdominio>.workers.dev`). El `--name`
sobreescribe el nombre autogenerado por nitro (que sale del remoto de git).

## 6. Auth0 (Authorization Server)

En <https://auth0.com>, dentro de tu tenant:

1. **Applications → Create Application** → *Regular Web Application*. Copia
   `Domain`, `Client ID`, `Client Secret`.
   - **Allowed Callback URLs:** `https://<tu-backend>.run.app/oauth/callback`
   - **Allowed Logout URLs:** `https://<tu-frontend>.workers.dev`
2. **Applications → APIs → Create API** → *Identifier* = `https://readuls-api`
   (= `AUTH0_AUDIENCE`). Sin API, el access token es opaco y la validación JWKS falla.
3. **APIs → tu API → Machine To Machine Applications:** autoriza tu Application
   (si aparece "Client is not authorized to access resource server", es esto).
4. **Authentication → Social → Google:** actívala para la Application (login institucional).
5. **Actions → Triggers → post-login:** Action que bloquea correos ≠ `@ulasalle.edu.pe`:
   ```js
   exports.onExecutePostLogin = async (event, api) => {
     if (!event.user.email?.endsWith("@ulasalle.edu.pe"))
       api.access.deny("Solo cuentas @ulasalle.edu.pe");
   };
   ```
6. Pon `AUTH0_*` en el `env.yaml` del backend y aplica (`gcloud run services update`).

El flujo: frontend → backend `/api/auth/login` → Auth0 (login+consent, Google
detrás) → callback en el backend → canje del `code` server-to-server → el backend
valida el access_token por **JWKS** en cada request y ancla identidad en el `sub`.

---

## Verificación

1. `GET https://<backend>/` → `{"status":"ok","app":"Readuls API v1"}`.
2. `GET https://<backend>/api/auth/login` → **302** a `https://<tenant>.auth0.com/authorize?...&audience=https://readuls-api`.
3. Abre el frontend → *Continuar con Google* → vuelve autenticado.
4. Crea un post con imagen → se sirve desde `pub-xxxx.r2.dev`.

## Notas

- Cloud Run escala a cero: primer request en frío ~1-3s; luego instantáneo.
- Cambiar `VITE_API_BASE_URL` requiere **recompilar** el frontend, no solo redeploy.
- Al cambiar la URL del backend o del frontend, actualiza la cascada:
  `AUTH0_CALLBACK_URL` + Allowed Callbacks (Auth0), `VITE_API_BASE_URL` (rebuild),
  `FRONTEND_URL` (Cloud Run) + Allowed Logout URLs (Auth0).
- El `docker-compose.yml` es solo para desarrollo local; producción no lo usa.
