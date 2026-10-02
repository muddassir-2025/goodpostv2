-- Video posts (YouTube-style): the stored object key of the uploaded video.
-- Rolled out safely with IF NOT EXISTS so re-running migrations is a no-op.
ALTER TABLE posts ADD COLUMN IF NOT EXISTS video_id text;
