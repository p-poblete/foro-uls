-- =============================================================
-- Readuls v1 — Triggers PostgreSQL
-- Depende de: 01_tables.sql
-- =============================================================

-- =============================================================
-- updated_at automático (reutilizable)
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
  FOR t IN SELECT unnest(ARRAY['users', 'communities', 'posts'])
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
-- member_count en communities
-- Se recalcula en cada INSERT / UPDATE / DELETE sobre community_members
-- =============================================================
CREATE OR REPLACE FUNCTION fn_update_community_member_count()
RETURNS TRIGGER AS $$
DECLARE
  v_community_id INTEGER;
BEGIN
  v_community_id := COALESCE(NEW.community_id, OLD.community_id);

  UPDATE communities
  SET member_count = (
    SELECT COUNT(*)
    FROM community_members
    WHERE community_id = v_community_id
  ),
  updated_at = NOW()
  WHERE id = v_community_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_community_member_count ON community_members;
CREATE TRIGGER trg_community_member_count
  AFTER INSERT OR DELETE ON community_members
  FOR EACH ROW EXECUTE FUNCTION fn_update_community_member_count();

-- =============================================================
-- post_count en communities
-- =============================================================
CREATE OR REPLACE FUNCTION fn_update_community_post_count()
RETURNS TRIGGER AS $$
DECLARE
  v_community_id INTEGER;
BEGIN
  v_community_id := COALESCE(NEW.community_id, OLD.community_id);

  UPDATE communities
  SET post_count = (
    SELECT COUNT(*)
    FROM posts
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
  AFTER INSERT OR UPDATE OF status, deleted_at OR DELETE ON posts
  FOR EACH ROW EXECUTE FUNCTION fn_update_community_post_count();

-- =============================================================
-- vote_score en posts
-- Se recalcula en cada INSERT / UPDATE / DELETE sobre post_votes
-- =============================================================
CREATE OR REPLACE FUNCTION fn_update_post_vote_score()
RETURNS TRIGGER AS $$
DECLARE
  v_post_id INTEGER;
BEGIN
  v_post_id := COALESCE(NEW.post_id, OLD.post_id);

  UPDATE posts
  SET vote_score = (
    SELECT COALESCE(SUM(vote_type), 0)
    FROM post_votes
    WHERE post_id = v_post_id
  ),
  updated_at = NOW()
  WHERE id = v_post_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_post_vote_score ON post_votes;
CREATE TRIGGER trg_post_vote_score
  AFTER INSERT OR UPDATE OR DELETE ON post_votes
  FOR EACH ROW EXECUTE FUNCTION fn_update_post_vote_score();
