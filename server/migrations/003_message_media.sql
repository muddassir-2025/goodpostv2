-- Chat media: the stored object key of an image attached to a message.
-- Null means a text-only message. IF NOT EXISTS keeps re-runs a no-op.
ALTER TABLE messages ADD COLUMN IF NOT EXISTS image_id text;
