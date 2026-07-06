-- =============================================================
-- Readuls v1 — Tablas PostgreSQL (integer PKs)
-- Ejecutar en orden: 01_tables.sql → 02_triggers.sql → 03_indexes.sql → 04_seed.sql
-- Este esquema es el que usa el ORM (backend/models.py) para v1.
-- El esquema con UUID PKs en ../01_schema.sql es el objetivo de producción.
-- =============================================================

-- =============================================================
-- CAREERS
-- Debe crearse antes que users (FK career_id)
-- =============================================================
CREATE TABLE IF NOT EXISTS careers (
  id         SERIAL       PRIMARY KEY,
  name       VARCHAR(200) NOT NULL,
  code       VARCHAR(20)  NOT NULL UNIQUE
);

-- =============================================================
-- USERS
-- =============================================================
CREATE TABLE IF NOT EXISTS users (
  id               SERIAL       PRIMARY KEY,
  external_auth_id VARCHAR(200) UNIQUE,                -- sub del JWT de Auth0
  auth_provider    VARCHAR(50)  NOT NULL DEFAULT 'auth0',
  username         VARCHAR(50)  NOT NULL UNIQUE,
  display_name     VARCHAR(100) NOT NULL,
  email            VARCHAR(255) NOT NULL UNIQUE,
  profile_image    TEXT,
  cover_image      TEXT,
  bio              TEXT,
  gender           VARCHAR(20)  CHECK (gender IN ('MALE', 'FEMALE', 'NON_BINARY')),
  career_id        INTEGER      REFERENCES careers(id) ON DELETE SET NULL,
  status           VARCHAR(20)  NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active', 'inactive', 'banned', 'suspended')),
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ
);

-- =============================================================
-- COMMUNITIES
-- =============================================================
CREATE TABLE IF NOT EXISTS communities (
  id            SERIAL       PRIMARY KEY,
  name          VARCHAR(100) NOT NULL UNIQUE,
  slug          VARCHAR(100) NOT NULL UNIQUE,
  description   TEXT,
  profile_image TEXT,
  cover_image   TEXT,
  owner_id      INTEGER      REFERENCES users(id) ON DELETE SET NULL,
  visibility    VARCHAR(20)  NOT NULL DEFAULT 'public'
                CHECK (visibility IN ('public', 'private', 'restricted')),
  member_count  INTEGER      NOT NULL DEFAULT 0,
  post_count    INTEGER      NOT NULL DEFAULT 0,
  status        VARCHAR(20)  NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'inactive', 'archived')),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ
);

-- =============================================================
-- COMMUNITY_MEMBERS
-- =============================================================
CREATE TABLE IF NOT EXISTS community_members (
  id           SERIAL      PRIMARY KEY,
  community_id INTEGER     NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  user_id      INTEGER     NOT NULL REFERENCES users(id)       ON DELETE CASCADE,
  role         VARCHAR(20) NOT NULL DEFAULT 'member'
               CHECK (role IN ('member', 'moderator', 'admin')),
  joined_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_community_members UNIQUE (community_id, user_id)
);

-- =============================================================
-- POSTS
-- =============================================================
CREATE TABLE IF NOT EXISTS posts (
  id            SERIAL       PRIMARY KEY,
  community_id  INTEGER      NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  author_id     INTEGER      REFERENCES users(id) ON DELETE SET NULL,
  title         VARCHAR(300) NOT NULL,
  content       TEXT,
  image_url     TEXT,
  post_type     VARCHAR(20)  NOT NULL DEFAULT 'text'
                CHECK (post_type IN ('text', 'image', 'link')),
  label         VARCHAR(20)  CHECK (label IN ('HELP', 'ANNOUNCEMENT', 'DISCUSSION', 'CASE')),
  tags          TEXT[],                                -- array simple de strings para v1
  vote_score    INTEGER      NOT NULL DEFAULT 0,
  comment_count INTEGER      NOT NULL DEFAULT 0,       -- desnormalizado, se incrementa desde el backend
  status        VARCHAR(20)  NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'removed', 'archived')),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ
);

-- =============================================================
-- POST_VOTES
-- =============================================================
CREATE TABLE IF NOT EXISTS post_votes (
  id         SERIAL      PRIMARY KEY,
  post_id    INTEGER     NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id    INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vote_type  SMALLINT    NOT NULL CHECK (vote_type IN (1, -1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_post_votes UNIQUE (post_id, user_id)
);
