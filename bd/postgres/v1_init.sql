-- =============================================================
-- Readuls v1 — Punto de entrada PostgreSQL
--
-- Uso:
--   psql -U readuls -d readuls -f bd/postgres/v1_init.sql
--
-- Requisitos previos:
--   CREATE DATABASE readuls;
--   CREATE USER readuls WITH PASSWORD 'readuls123';
--   GRANT ALL PRIVILEGES ON DATABASE readuls TO readuls;
--
-- Nota: Este script usa el esquema v1 (integer PKs) compatible
-- con backend/models.py. El esquema de producción con UUID PKs
-- está en bd/postgres/01_schema.sql y se usará en iteraciones futuras.
-- =============================================================

\i bd/postgres/v1/01_tables.sql
\i bd/postgres/v1/02_triggers.sql
\i bd/postgres/v1/03_indexes.sql
\i bd/postgres/v1/04_seed.sql

-- Verificar tablas creadas
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
