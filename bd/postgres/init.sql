-- =============================================================
-- Readuls — PostgreSQL init (ejecutar como superusuario)
-- Crea la BD, el usuario y corre los scripts en orden
-- =============================================================

-- Crear base de datos (ejecutar conectado a postgres)
-- CREATE DATABASE readuls ENCODING 'UTF8' LC_COLLATE 'es_PE.UTF-8' LC_CTYPE 'es_PE.UTF-8';
-- CREATE USER readuls_app WITH PASSWORD 'changeme';
-- GRANT ALL PRIVILEGES ON DATABASE readuls TO readuls_app;

-- Conectar a readuls y ejecutar en orden:
\i 01_schema.sql
\i 02_triggers.sql
\i 03_indexes.sql

-- Verificar tablas creadas
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
