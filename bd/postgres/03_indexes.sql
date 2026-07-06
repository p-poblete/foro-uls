-- =============================================================
-- Readuls — PostgreSQL Composite Indexes (Performance)
-- Depende de: 01_schema.sql, 02_triggers.sql
-- =============================================================

-- =============================================================
-- Feed de comunidad — los índices más críticos del sistema
-- =============================================================

-- Feed hot (query más frecuente): hot_score DESC + cursor por id
CREATE INDEX IF NOT EXISTS idx_posts_feed_hot
  ON posts(community_id, hot_score DESC, created_at DESC)
  WHERE deleted_at IS NULL AND status = 'active';

-- Feed new: paginación cursor-based por fecha
CREATE INDEX IF NOT EXISTS idx_posts_feed_new
  ON posts(community_id, created_at DESC, id DESC)
  WHERE deleted_at IS NULL AND status = 'active';

-- Feed top: votos totales
CREATE INDEX IF NOT EXISTS idx_posts_feed_top
  ON posts(community_id, vote_score DESC, id DESC)
  WHERE deleted_at IS NULL AND status = 'active';

-- Posts del perfil de un usuario
CREATE INDEX IF NOT EXISTS idx_posts_author_created
  ON posts(author_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- =============================================================
-- Notificaciones
-- =============================================================

-- Inbox del usuario (leídas + no leídas, por fecha)
CREATE INDEX IF NOT EXISTS idx_notifications_inbox
  ON notifications(recipient_id, is_read, created_at DESC)
  WHERE deleted_at IS NULL;

-- =============================================================
-- Comunidades
-- =============================================================

-- Listado de comunidades por universidad filtradas por visibilidad
CREATE INDEX IF NOT EXISTS idx_communities_university_visibility
  ON communities(university_id, visibility, member_count DESC)
  WHERE deleted_at IS NULL AND status = 'active';

-- Trending: comunidades con más miembros (homepage)
CREATE INDEX IF NOT EXISTS idx_communities_trending
  ON communities(member_count DESC, post_count DESC)
  WHERE deleted_at IS NULL AND status = 'active' AND visibility = 'public';

-- =============================================================
-- Búsqueda full-text (activo solo si NO se usa Elasticsearch)
-- =============================================================

CREATE INDEX IF NOT EXISTS idx_posts_search
  ON posts USING GIN(search_vector);

CREATE INDEX IF NOT EXISTS idx_communities_search
  ON communities USING GIN(search_vector);

-- Búsqueda por trigrama en username y display_name
CREATE INDEX IF NOT EXISTS idx_users_username_trgm
  ON users USING GIN(username gin_trgm_ops)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_users_display_name_trgm
  ON users USING GIN(display_name gin_trgm_ops)
  WHERE deleted_at IS NULL;

-- =============================================================
-- Moderación
-- =============================================================

-- Cola de reportes pendientes por comunidad
CREATE INDEX IF NOT EXISTS idx_reports_queue
  ON reports(community_id, status, created_at DESC)
  WHERE deleted_at IS NULL AND status IN ('pending', 'reviewing');

-- Historial de acciones de un moderador en una comunidad
CREATE INDEX IF NOT EXISTS idx_moderation_history
  ON moderation_actions(community_id, moderator_id, created_at DESC);

-- =============================================================
-- Votos — check rápido del voto del usuario en un post
-- =============================================================
CREATE INDEX IF NOT EXISTS idx_post_votes_lookup
  ON post_votes(post_id, user_id, vote_type)
  WHERE status = 'active' AND deleted_at IS NULL;

-- =============================================================
-- Suspensiones activas de usuarios
-- =============================================================
CREATE INDEX IF NOT EXISTS idx_users_banned_until
  ON users(banned_until)
  WHERE status = 'suspended' AND banned_until IS NOT NULL;
