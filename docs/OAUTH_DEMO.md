# Demo: login con Google (OAuth básico)

Flujo authorization-code real contra Google. No requiere Postgres ni Mongo
para el login (el backend arranca igual si las BD no están levantadas).

## Ejecutar

**Backend** (raíz del repo):
```bash
pip install -r backend/requirements.txt
python backend/app.py            # http://localhost:5000
```

**Frontend** (dentro de `frontend/`):
```bash
bun install
bun dev                          # http://localhost:5173
```

Abre http://localhost:5173/login → **Continuar con Google**.

## Cómo funciona

1. Frontend → `GET /api/auth/google/login` (backend) → redirige a Google.
2. Google → `GET /oauth/callback` → el backend canjea el `code`, lee el
   perfil (`userinfo`) y firma un token (itsdangerous).
3. Redirige a `http://localhost:5173/oauth/callback#token=…&user=…`; el
   frontend guarda la sesión (`setSession`) y entra al foro.

## Config (`backend/.env`)

`GOOGLE_CLIENT_ID/SECRET` ya vienen con credenciales de prueba. El
`GOOGLE_REDIRECT_URI` (`http://localhost:5000/oauth/callback`) debe estar
registrado en la consola de Google del cliente. Para producción, crea tu
propio cliente OAuth y reemplaza esos valores y `FLASK_SECRET_KEY`.
