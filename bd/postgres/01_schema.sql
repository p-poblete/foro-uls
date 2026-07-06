-- =============================================================
-- Readuls — PostgreSQL Schema
-- Ejecutar en orden: 01_schema.sql → 02_triggers.sql → 03_indexes.sql
-- =============================================================

-- Extensiones
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pg_trgm";    -- índices trigram para búsqueda

-- =============================================================
-- USERS (se crea primero; las FK a universities/careers
-- se agregan al final para romper la dependencia circular)
-- =============================================================
CREATE TABLE IF NOT EXISTS users (
  id                        UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  external_auth_id          VARCHAR(200) NOT NULL UNIQUE,
  auth_provider             VARCHAR(50)  NOT NULL DEFAULT 'clerk'
                            CHECK (auth_provider IN ('clerk', 'auth0', 'supabase', 'firebase', 'cognito')),
  username                  VARCHAR(50)  NOT NULL UNIQUE,
  display_name              VARCHAR(100) NOT NULL,
  email                     VARCHAR(255) NOT NULL UNIQUE,
  institutional_email       VARCHAR(255) NULL UNIQUE,
  avatar_url                TEXT         NULL,
  bio                       TEXT         NULL,
  university_id             UUID         NULL,  -- FK añadida tras crear universities
  career_id                 UUID         NULL,  -- FK añadida tras crear careers
  academic_year             SMALLINT     NULL   CHECK (academic_year BETWEEN 1 AND 10),
  is_institutional_verified BOOLEAN      NOT NULL DEFAULT false,
  role                      VARCHAR(20)  NOT NULL DEFAULT 'user'
                            CHECK (role IN ('user', 'moderator', 'admin', 'superadmin')),
  reputation                INTEGER      NOT NULL DEFAULT 0,
  post_karma                INTEGER      NOT NULL DEFAULT 0,
  comment_karma             INTEGER      NOT NULL DEFAULT 0,
  status                    VARCHAR(20)  NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active', 'inactive', 'banned', 'suspended')),
  banned_until              TIMESTAMPTZ  NULL,
  last_seen_at              TIMESTAMPTZ  NULL,
  created_at                TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at                TIMESTAMPTZ  NULL,
  created_by                UUID         NULL REFERENCES users(id) ON DELETE SET NULL,
  updated_by                UUID         NULL REFERENCES users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username
  ON users(username) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email
  ON users(email) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_external_auth_id
  ON users(external_auth_id);
CREATE INDEX IF NOT EXISTS idx_users_status
  ON users(status) WHERE deleted_at IS NULL;

-- =============================================================
-- UNIVERSITIES
-- =============================================================
CREATE TABLE IF NOT EXISTS universities (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(200) NOT NULL,
  slug        VARCHAR(100) NOT NULL UNIQUE,
  domain      VARCHAR(100) NOT NULL UNIQUE,
  logo_url    TEXT         NULL,
  country     CHAR(2)      NOT NULL DEFAULT 'PE',
  is_verified BOOLEAN      NOT NULL DEFAULT false,
  status      VARCHAR(20)  NOT NULL DEFAULT 'active'
              CHECK (status IN ('active', 'inactive', 'pending')),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ  NULL,
  created_by  UUID         NULL REFERENCES users(id) ON DELETE SET NULL,
  updated_by  UUID         NULL REFERENCES users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_universities_domain
  ON universities(domain) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_universities_slug
  ON universities(slug) WHERE deleted_at IS NULL;

-- =============================================================
-- CAREERS
-- =============================================================
CREATE TABLE IF NOT EXISTS careers (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID         NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  name          VARCHAR(200) NOT NULL,
  slug          VARCHAR(100) NOT NULL,
  faculty       VARCHAR(200) NULL,
  code          VARCHAR(20)  NULL,
  status        VARCHAR(20)  NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'inactive')),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ  NULL,
  created_by    UUID         NULL REFERENCES users(id) ON DELETE SET NULL,
  updated_by    UUID         NULL REFERENCES users(id) ON DELETE SET NULL,

  CONSTRAINT uq_careers_slug_university UNIQUE (university_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_careers_university_id
  ON careers(university_id);
CREATE INDEX IF NOT EXISTS idx_careers_faculty
  ON careers(faculty) WHERE deleted_at IS NULL;

-- =============================================================
-- FK circulares de users → universities / careers
-- =============================================================
ALTER TABLE users
  ADD CONSTRAINT fk_users_university
    FOREIGN KEY (university_id) REFERENCES universities(id) ON DELETE SET NULL;

ALTER TABLE users
  ADD CONSTRAINT fk_users_career
    FOREIGN KEY (career_id) REFERENCES careers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_university_id ON users(university_id);
CREATE INDEX IF NOT EXISTS idx_users_career_id     ON users(career_id);

-- =============================================================
-- COMMUNITIES
-- =============================================================
CREATE TABLE IF NOT EXISTS communities (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name             VARCHAR(100) NOT NULL UNIQUE,
  slug             VARCHAR(100) NOT NULL UNIQUE,
  description      TEXT         NULL,
  long_description TEXT         NULL,
  avatar_url       TEXT         NULL,
  banner_url       TEXT         NULL,
  university_id    UUID         NULL REFERENCES universities(id) ON DELETE SET NULL,
  career_id        UUID         NULL REFERENCES careers(id)      ON DELETE SET NULL,
  owner_id         UUID         NOT NULL REFERENCES users(id)    ON DELETE RESTRICT,
  visibility       VARCHAR(20)  NOT NULL DEFAULT 'public'
                   CHECK (visibility IN ('public', 'private', 'restricted')),
  join_policy      VARCHAR(20)  NOT NULL DEFAULT 'open'
                   CHECK (join_policy IN ('open', 'approval', 'invite_only')),
  member_count     INTEGER      NOT NULL DEFAULT 0,
  post_count       INTEGER      NOT NULL DEFAULT 0,
  rules            JSONB        NULL,
  status           VARCHAR(20)  NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active', 'inactive', 'archived', 'banned')),
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ  NULL,
  created_by       UUID         NULL REFERENCES users(id) ON DELETE SET NULL,
  updated_by       UUID         NULL REFERENCES users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_communities_slug
  ON communities(slug) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_communities_university_id
  ON communities(university_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_communities_career_id
  ON communities(career_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_communities_owner_id
  ON communities(owner_id);
CREATE INDEX IF NOT EXISTS idx_communities_visibility
  ON communities(visibility) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_communities_member_count
  ON communities(member_count DESC) WHERE deleted_at IS NULL;

-- =============================================================
-- COMMUNITY_MEMBERS
-- =============================================================
CREATE TABLE IF NOT EXISTS community_members (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID        NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  user_id      UUID        NOT NULL REFERENCES users(id)       ON DELETE CASCADE,
  role         VARCHAR(20) NOT NULL DEFAULT 'member'
               CHECK (role IN ('member', 'moderator', 'admin')),
  join_status  VARCHAR(20) NOT NULL DEFAULT 'active'
               CHECK (join_status IN ('active', 'pending', 'banned', 'muted')),
  muted_until  TIMESTAMPTZ NULL,
  banned_reason TEXT       NULL,
  status       VARCHAR(20) NOT NULL DEFAULT 'active'
               CHECK (status IN ('active', 'inactive')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at   TIMESTAMPTZ NULL,
  created_by   UUID        NULL REFERENCES users(id) ON DELETE SET NULL,
  updated_by   UUID        NULL REFERENCES users(id) ON DELETE SET NULL,

  CONSTRAINT uq_community_members UNIQUE (community_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_community_members_community_id
  ON community_members(community_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_community_members_user_id
  ON community_members(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_community_members_role
  ON community_members(community_id, role) WHERE deleted_at IS NULL;

-- =============================================================
-- POSTS
-- =============================================================
CREATE TABLE IF NOT EXISTS posts (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id   UUID         NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  author_id      UUID         NOT NULL REFERENCES users(id)       ON DELETE SET NULL,
  title          VARCHAR(300) NOT NULL,
  content        TEXT         NULL,
  post_type      VARCHAR(20)  NOT NULL DEFAULT 'text'
                 CHECK (post_type IN ('text', 'image', 'video', 'link', 'poll')),
  link_url       TEXT         NULL,
  is_pinned      BOOLEAN      NOT NULL DEFAULT false,
  is_locked      BOOLEAN      NOT NULL DEFAULT false,
  is_nsfw        BOOLEAN      NOT NULL DEFAULT false,
  is_spoiler     BOOLEAN      NOT NULL DEFAULT false,
  vote_score     INTEGER      NOT NULL DEFAULT 0,
  upvote_count   INTEGER      NOT NULL DEFAULT 0,
  downvote_count INTEGER      NOT NULL DEFAULT 0,
  comment_count  INTEGER      NOT NULL DEFAULT 0,
  view_count     INTEGER      NOT NULL DEFAULT 0,
  hot_score      FLOAT8       NOT NULL DEFAULT 0,
  status         VARCHAR(20)  NOT NULL DEFAULT 'active'
                 CHECK (status IN ('active', 'removed', 'archived', 'spam')),
  removed_reason TEXT         NULL,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at     TIMESTAMPTZ  NULL,
  created_by     UUID         NULL REFERENCES users(id) ON DELETE SET NULL,
  updated_by     UUID         NULL REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_posts_community_id
  ON posts(community_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_posts_author_id
  ON posts(author_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_posts_community_hot
  ON posts(community_id, hot_score DESC)
  WHERE deleted_at IS NULL AND status = 'active';
CREATE INDEX IF NOT EXISTS idx_posts_community_new
  ON posts(community_id, created_at DESC)
  WHERE deleted_at IS NULL AND status = 'active';
CREATE INDEX IF NOT EXISTS idx_posts_community_top
  ON posts(community_id, vote_score DESC)
  WHERE deleted_at IS NULL AND status = 'active';
CREATE INDEX IF NOT EXISTS idx_posts_is_pinned
  ON posts(community_id, is_pinned)
  WHERE is_pinned = true AND deleted_at IS NULL;

-- =============================================================
-- POST_MEDIA
-- =============================================================
CREATE TABLE IF NOT EXISTS post_media (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id         UUID         NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  storage_key     VARCHAR(500) NOT NULL,
  url             TEXT         NOT NULL,
  thumbnail_url   TEXT         NULL,
  media_type      VARCHAR(20)  NOT NULL
                  CHECK (media_type IN ('image', 'video', 'gif', 'document')),
  mime_type       VARCHAR(100) NOT NULL,
  file_size_bytes BIGINT       NULL,
  width           INTEGER      NULL,
  height          INTEGER      NULL,
  duration_secs   INTEGER      NULL,
  position        SMALLINT     NOT NULL DEFAULT 0,
  alt_text        VARCHAR(300) NULL,
  status          VARCHAR(20)  NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'deleted', 'processing')),
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ  NULL,
  created_by      UUID         NULL REFERENCES users(id) ON DELETE SET NULL,
  updated_by      UUID         NULL REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_post_media_post_id
  ON post_media(post_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_post_media_storage_key
  ON post_media(storage_key);

-- =============================================================
-- TAGS
-- =============================================================
CREATE TABLE IF NOT EXISTS tags (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(50) NOT NULL UNIQUE,
  slug          VARCHAR(50) NOT NULL UNIQUE,
  description   TEXT        NULL,
  color         CHAR(7)     NULL CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
  university_id UUID        NULL REFERENCES universities(id) ON DELETE SET NULL,
  usage_count   INTEGER     NOT NULL DEFAULT 0,
  status        VARCHAR(20) NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'inactive', 'deprecated')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ NULL,
  created_by    UUID        NULL REFERENCES users(id) ON DELETE SET NULL,
  updated_by    UUID        NULL REFERENCES users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_slug
  ON tags(slug) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tags_usage_count
  ON tags(usage_count DESC) WHERE deleted_at IS NULL;

-- =============================================================
-- POST_TAGS
-- =============================================================
CREATE TABLE IF NOT EXISTS post_tags (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID        NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  tag_id     UUID        NOT NULL REFERENCES tags(id)  ON DELETE CASCADE,
  status     VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  created_by UUID        NULL REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID        NULL REFERENCES users(id) ON DELETE SET NULL,

  CONSTRAINT uq_post_tags UNIQUE (post_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_post_tags_post_id ON post_tags(post_id);
CREATE INDEX IF NOT EXISTS idx_post_tags_tag_id
  ON post_tags(tag_id) WHERE deleted_at IS NULL;

-- =============================================================
-- POST_VOTES
-- =============================================================
CREATE TABLE IF NOT EXISTS post_votes (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID        NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vote_type  SMALLINT    NOT NULL CHECK (vote_type IN (1, -1)),
  status     VARCHAR(20) NOT NULL DEFAULT 'active'
             CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  created_by UUID        NULL REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID        NULL REFERENCES users(id) ON DELETE SET NULL,

  CONSTRAINT uq_post_votes UNIQUE (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_post_votes_post_id
  ON post_votes(post_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_post_votes_user_id
  ON post_votes(user_id) WHERE deleted_at IS NULL;

-- =============================================================
-- NOTIFICATIONS
-- =============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_id          UUID        NULL     REFERENCES users(id) ON DELETE SET NULL,
  notification_type VARCHAR(50) NOT NULL
                    CHECK (notification_type IN (
                      'post_reply', 'comment_reply', 'post_vote',
                      'community_approved', 'community_banned',
                      'mention', 'post_removed', 'report_resolved'
                    )),
  entity_type       VARCHAR(20) NOT NULL
                    CHECK (entity_type IN ('post', 'comment', 'community', 'user')),
  entity_id         VARCHAR(100) NOT NULL,
  payload           JSONB       NOT NULL DEFAULT '{}',
  is_read           BOOLEAN     NOT NULL DEFAULT false,
  read_at           TIMESTAMPTZ NULL,
  status            VARCHAR(20) NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'archived', 'deleted')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ NULL,
  created_by        UUID        NULL REFERENCES users(id) ON DELETE SET NULL,
  updated_by        UUID        NULL REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_id
  ON notifications(recipient_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_unread
  ON notifications(recipient_id, is_read)
  WHERE is_read = false AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_entity
  ON notifications(entity_type, entity_id);

-- =============================================================
-- REPORTS
-- =============================================================
CREATE TABLE IF NOT EXISTS reports (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id     UUID         NOT NULL REFERENCES users(id)        ON DELETE SET NULL,
  content_type    VARCHAR(20)  NOT NULL
                  CHECK (content_type IN ('post', 'comment', 'user', 'community')),
  content_id      VARCHAR(100) NOT NULL,
  community_id    UUID         NULL REFERENCES communities(id)      ON DELETE SET NULL,
  reason          VARCHAR(50)  NOT NULL
                  CHECK (reason IN (
                    'spam', 'harassment', 'hate_speech', 'misinformation',
                    'nsfw', 'off_topic', 'plagiarism', 'other'
                  )),
  description     TEXT         NULL,
  resolution      VARCHAR(20)  NULL
                  CHECK (resolution IN ('pending', 'resolved', 'dismissed', 'escalated')),
  resolved_by     UUID         NULL REFERENCES users(id)            ON DELETE SET NULL,
  resolved_at     TIMESTAMPTZ  NULL,
  resolution_note TEXT         NULL,
  status          VARCHAR(20)  NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'reviewing', 'resolved', 'dismissed')),
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ  NULL,
  created_by      UUID         NULL REFERENCES users(id) ON DELETE SET NULL,
  updated_by      UUID         NULL REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_reports_content
  ON reports(content_type, content_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_reports_community_id
  ON reports(community_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_reports_status
  ON reports(status, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_reports_reporter_id
  ON reports(reporter_id);

-- =============================================================
-- MODERATION_ACTIONS  (append-only en práctica)
-- =============================================================
CREATE TABLE IF NOT EXISTS moderation_actions (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  moderator_id UUID         NOT NULL REFERENCES users(id)        ON DELETE RESTRICT,
  community_id UUID         NULL     REFERENCES communities(id)  ON DELETE SET NULL,
  target_type  VARCHAR(20)  NOT NULL
               CHECK (target_type IN ('post', 'comment', 'user', 'community')),
  target_id    VARCHAR(100) NOT NULL,
  action       VARCHAR(50)  NOT NULL
               CHECK (action IN (
                 'remove_post',    'restore_post',
                 'remove_comment', 'restore_comment',
                 'ban_user',       'unban_user',
                 'mute_user',      'unmute_user',
                 'pin_post',       'unpin_post',
                 'lock_post',      'unlock_post',
                 'approve_member', 'reject_member'
               )),
  reason       TEXT         NULL,
  expires_at   TIMESTAMPTZ  NULL,
  report_id    UUID         NULL REFERENCES reports(id)          ON DELETE SET NULL,
  metadata     JSONB        NULL,
  status       VARCHAR(20)  NOT NULL DEFAULT 'active'
               CHECK (status IN ('active', 'reverted')),
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at   TIMESTAMPTZ  NULL,
  created_by   UUID         NULL REFERENCES users(id) ON DELETE SET NULL,
  updated_by   UUID         NULL REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_moderation_actions_moderator_id
  ON moderation_actions(moderator_id);
CREATE INDEX IF NOT EXISTS idx_moderation_actions_community_id
  ON moderation_actions(community_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_moderation_actions_target
  ON moderation_actions(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_moderation_actions_report_id
  ON moderation_actions(report_id);
