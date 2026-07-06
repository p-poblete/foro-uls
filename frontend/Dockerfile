FROM oven/bun:1

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install

COPY . .

EXPOSE 8080

# Modo desarrollo (Vite). VITE_API_BASE_URL viene de frontend/.env (el navegador
# del host llama al backend en localhost:5000).
CMD ["bunx", "vite", "dev", "--host", "0.0.0.0", "--port", "8080"]
