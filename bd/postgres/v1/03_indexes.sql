-- =============================================================
-- Readuls v1 — Índices PostgreSQL
-- Depende de: 01_tables.sql
-- =============================================================

-- =============================================================
-- users
-- =============================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_v1_users_external_auth_id
  ON users(external_auth_id)
  WHERE external_auth_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_v1_users_email
  ON users(email)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_v1_users_username
  ON users(username)
  WHERE deleted_at IS NULL;

-- =============================================================
-- communities
-- =============================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_v1_communities_slug
  ON communities(slug)
  WHERE deleted_at IS NULL;

-- Listado ordenado por miembros (sidebar / trending)
CREATE INDEX IF NOT EXISTS idx_v1_communities_member_count
  ON communities(member_count DESC)
  WHERE deleted_at IS NULL AND status = 'active';

-- =============================================================
-- community_members
-- =============================================================
CREATE INDEX IF NOT EXISTS idx_v1_cm_community
  ON community_members(community_id);

CREATE INDEX IF NOT EXISTS idx_v1_cm_user
  ON community_members(user_id);

-- =============================================================
-- posts
-- =============================================================

-- Feed principal: posts de una comunidad ordenados por fecha
CREATE INDEX IF NOT EXISTS idx_v1_posts_community_new
  ON posts(community_id, created_at DESC)
  WHERE deleted_at IS NULL AND status = 'active';

-- Feed global ordenado por fecha (GET /api/posts)
CREATE INDEX IF NOT EXISTS idx_v1_posts_global_new
  ON posts(created_at DESC)
  WHERE deleted_at IS NULL AND status = 'active';

-- Filtro por label (anuncios, ayuda, etc.)
CREATE INDEX IF NOT EXISTS idx_v1_posts_label
  ON posts(label)
  WHERE deleted_at IS NULL AND status = 'active';

-- Posts de un autor (perfil de usuario)
CREATE INDEX IF NOT EXISTS idx_v1_posts_author
  ON posts(author_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- =============================================================
-- post_votes
-- =============================================================

-- Lookup rápido del voto de un usuario en un post
CREATE INDEX IF NOT EXISTS idx_v1_post_votes_lookup
  ON post_votes(post_id, user_id);
