FROM python:3.13-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 5000

# Siembra datos (idempotente) y arranca el servidor. La config (DB, OAuth) llega
# por variables de entorno del docker-compose, no por .env (excluido del build).
CMD ["sh", "-c", "python seed.py || echo 'seed omitido'; python app.py"]
