FROM python:3.13-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 5000

# Siembra datos (idempotente) y arranca gunicorn (producción). La config (DB, OAuth,
# storage) llega por variables de entorno del host, no por .env (excluido del build).
# Bind a $PORT (Koyeb/Render lo inyectan) con fallback a 5000 para docker-compose local.
CMD ["sh", "-c", "python seed.py || echo 'seed omitido'; exec gunicorn --bind 0.0.0.0:${PORT:-5000} --workers 2 'app:create_app()'"]
