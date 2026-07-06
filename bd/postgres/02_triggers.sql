-- =============================================================
-- Readuls — PostgreSQL Triggers & Functions
-- Depende de: 01_schema.sql
-- =============================================================

-- =============================================================
-- updated_at automático (reutilizable en todas las tablas)
-- =============================================================
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'users', 'universities', 'careers', 'communities', 'community_members',
      'posts', 'post_media', 'tags', 'post_tags', 'post_votes',
      'notifications', 'reports', 'moderation_actions'
    ])
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_set_updated_at ON %I;
       CREATE TRIGGER trg_set_updated_at
         BEFORE UPDATE ON %I
         FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();',
      t, t
    );
  END LOOP;
END;
$$;

-- =============================================================
-- Contadores desnormalizados de votos en posts
-- Actualiza upvote_count, downvote_count y vote_score
-- en cada INSERT / UPDATE / DELETE sobre post_votes
-- =============================================================
CREATE OR REPLACE FUNCTION fn_update_post_vote_counts()
RETURNS TRIGGER AS $$
DECLARE
  v_post_id UUID;
BEGIN
  v_post_id := COALESCE(NEW.post_id, OLD.post_id);

  UPDATE posts SET
    upvote_count   = (
      SELECT COUNT(*) FROM post_votes
      WHERE post_id = v_post_id AND vote_type = 1
        AND status = 'active' AND deleted_at IS NULL
    ),
    downvote_count = (
      SELECT COUNT(*) FROM post_votes
      WHERE post_id = v_post_id AND vote_type = -1
        AND status = 'active' AND deleted_at IS NULL
    ),
    vote_score     = upvote_count - downvote_count,
    updated_at     = NOW()
  WHERE id = v_post_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_post_vote_counts ON post_votes;
CREATE TRIGGER trg_post_vote_counts
  AFTER INSERT OR UPDATE OR DELETE ON post_votes
  FOR EACH ROW EXECUTE FUNCTION fn_update_post_vote_counts();

-- =============================================================
-- Karma del autor cuando su post recibe votos
-- =============================================================
CREATE OR REPLACE FUNCTION fn_update_author_post_karma()
RETURNS TRIGGER AS $$
DECLARE
  v_author_id UUID;
  v_delta     INTEGER;
BEGIN
  SELECT author_id INTO v_author_id FROM posts WHERE id = COALESCE(NEW.post_id, OLD.post_id);

  IF TG_OP = 'INSERT' THEN
    v_delta := NEW.vote_type;
  ELSIF TG_OP = 'DELETE' THEN
    v_delta := -OLD.vote_type;
  ELSE  -- UPDATE (cambio de voto)
    v_delta := NEW.vote_type - OLD.vote_type;
  END IF;

  UPDATE users SET
    post_karma = post_karma + v_delta,
    reputation = reputation + v_delta,
    updated_at = NOW()
  WHERE id = v_author_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_author_post_karma ON post_votes;
CREATE TRIGGER trg_author_post_karma
  AFTER INSERT OR UPDATE OR DELETE ON post_votes
  FOR EACH ROW EXECUTE FUNCTION fn_update_author_post_karma();

-- =============================================================
-- member_count en communities al insertar/borrar en community_members
-- =============================================================
CREATE OR REPLACE FUNCTION fn_update_community_member_count()
RETURNS TRIGGER AS $$
DECLARE
  v_community_id UUID;
BEGIN
  v_community_id := COALESCE(NEW.community_id, OLD.community_id);

  UPDATE communities SET
    member_count = (
      SELECT COUNT(*) FROM community_members
      WHERE community_id = v_community_id
        AND join_status = 'active'
        AND deleted_at IS NULL
    ),
    updated_at = NOW()
  WHERE id = v_community_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_community_member_count ON community_members;
CREATE TRIGGER trg_community_member_count
  AFTER INSERT OR UPDATE OR DELETE ON community_members
  FOR EACH ROW EXECUTE FUNCTION fn_update_community_member_count();

-- =============================================================
-- post_count en communities al insertar/borrar posts
-- =============================================================
CREATE OR REPLACE FUNCTION fn_update_community_post_count()
RETURNS TRIGGER AS $$
DECLARE
  v_community_id UUID;
BEGIN
  v_community_id := COALESCE(NEW.community_id, OLD.community_id);

  UPDATE communities SET
    post_count = (
      SELECT COUNT(*) FROM posts
      WHERE community_id = v_community_id
        AND status = 'active'
        AND deleted_at IS NULL
    ),
    updated_at = NOW()
  WHERE id = v_community_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_community_post_count ON posts;
CREATE TRIGGER trg_community_post_count
  AFTER INSERT OR UPDATE OR DELETE ON posts
  FOR EACH ROW EXECUTE FUNCTION fn_update_community_post_count();

-- =============================================================
-- usage_count en tags al insertar/borrar en post_tags
-- =============================================================
CREATE OR REPLACE FUNCTION fn_update_tag_usage_count()
RETURNS TRIGGER AS $$
DECLARE
  v_tag_id UUID;
BEGIN
  v_tag_id := COALESCE(NEW.tag_id, OLD.tag_id);

  UPDATE tags SET
    usage_count = (
      SELECT COUNT(*) FROM post_tags
      WHERE tag_id = v_tag_id AND deleted_at IS NULL
    ),
    updated_at = NOW()
  WHERE id = v_tag_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tag_usage_count ON post_tags;
CREATE TRIGGER trg_tag_usage_count
  AFTER INSERT OR UPDATE OR DELETE ON post_tags
  FOR EACH ROW EXECUTE FUNCTION fn_update_tag_usage_count();

-- =============================================================
-- read_at automático al marcar notificación como leída
-- =============================================================
CREATE OR REPLACE FUNCTION fn_set_notification_read_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_read = true AND OLD.is_read = false THEN
    NEW.read_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notification_read_at ON notifications;
CREATE TRIGGER trg_notification_read_at
  BEFORE UPDATE ON notifications
  FOR EACH ROW EXECUTE FUNCTION fn_set_notification_read_at();

-- =============================================================
-- search_vector en posts (solo si NO se usa Elasticsearch)
-- =============================================================
ALTER TABLE posts ADD COLUMN IF NOT EXISTS search_vector TSVECTOR;

CREATE OR REPLACE FUNCTION fn_posts_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('pg_catalog.spanish', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('pg_catalog.spanish', COALESCE(NEW.content, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_posts_search_vector ON posts;
CREATE TRIGGER trg_posts_search_vector
  BEFORE INSERT OR UPDATE ON posts
  FOR EACH ROW EXECUTE FUNCTION fn_posts_search_vector();

-- =============================================================
-- search_vector en communities
-- =============================================================
ALTER TABLE communities ADD COLUMN IF NOT EXISTS search_vector TSVECTOR;

CREATE OR REPLACE FUNCTION fn_communities_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('pg_catalog.spanish', COALESCE(NEW.name, '')), 'A') ||
    setweight(to_tsvector('pg_catalog.spanish', COALESCE(NEW.description, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_communities_search_vector ON communities;
CREATE TRIGGER trg_communities_search_vector
  BEFORE INSERT OR UPDATE ON communities
  FOR EACH ROW EXECUTE FUNCTION fn_communities_search_vector();
