-- GoodPost v2 — initial schema (Neon Postgres)
-- Auth users live in the `neon_auth` schema (managed by Neon Auth).
-- Everything below is application data keyed by the auth user's uuid.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Application profile data that augments neon_auth.user
CREATE TABLE IF NOT EXISTS profiles (
  id          uuid PRIMARY KEY,
  email       text,
  name        text NOT NULL DEFAULT 'Guest',
  bio         text DEFAULT '',
  avatar_id   text,
  is_admin    boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS posts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title          text NOT NULL DEFAULT '',
  content        text NOT NULL DEFAULT '',
  slug           text NOT NULL UNIQUE,
  author_id      uuid NOT NULL,
  author_name    text NOT NULL DEFAULT 'Guest',
  featured_img   text,
  audio_id       text,
  tags           text[] NOT NULL DEFAULT '{}',
  is_published   boolean NOT NULL DEFAULT true,
  like_count     integer NOT NULL DEFAULT 0,
  comment_count  integer NOT NULL DEFAULT 0,
  is_system      boolean NOT NULL DEFAULT false,
  report_count   integer NOT NULL DEFAULT 0,
  reported_by    uuid[] NOT NULL DEFAULT '{}',
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS posts_author_idx ON posts (author_id);
CREATE INDEX IF NOT EXISTS posts_created_idx ON posts (created_at DESC);
CREATE INDEX IF NOT EXISTS posts_tags_idx ON posts USING gin (tags);

CREATE TABLE IF NOT EXISTS likes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    uuid NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
  user_id    uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);
CREATE INDEX IF NOT EXISTS likes_user_idx ON likes (user_id);

CREATE TABLE IF NOT EXISTS comments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    uuid NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
  user_id    uuid NOT NULL,
  user_name  text NOT NULL DEFAULT 'Guest',
  content    text NOT NULL DEFAULT '',
  parent_id  uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS comments_post_idx ON comments (post_id);

CREATE TABLE IF NOT EXISTS favorites (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL,
  post_id    uuid NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, post_id)
);
CREATE INDEX IF NOT EXISTS favorites_user_idx ON favorites (user_id);

CREATE TABLE IF NOT EXISTS follows (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id  uuid NOT NULL,
  following_id uuid NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (follower_id, following_id)
);
CREATE INDEX IF NOT EXISTS follows_following_idx ON follows (following_id);
CREATE INDEX IF NOT EXISTS follows_follower_idx ON follows (follower_id);

CREATE TABLE IF NOT EXISTS conversations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  members         uuid[] NOT NULL,
  last_message    text NOT NULL DEFAULT '',
  last_message_at timestamptz NOT NULL DEFAULT now(),
  unread_count    integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS conversations_members_idx ON conversations USING gin (members);

CREATE TABLE IF NOT EXISTS messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
  sender_id       uuid NOT NULL,
  text            text NOT NULL DEFAULT '',
  seen            boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS messages_conversation_idx ON messages (conversation_id, created_at DESC);

CREATE TABLE IF NOT EXISTS notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL,
  actor_id   uuid,
  actor_name text NOT NULL DEFAULT 'Guest',
  type       text NOT NULL,
  post_id    uuid,
  post_slug  text,
  content    text,
  is_read    boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS stories (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL,
  user_name  text NOT NULL DEFAULT 'Guest',
  image_url  text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS stories_created_idx ON stories (created_at DESC);
