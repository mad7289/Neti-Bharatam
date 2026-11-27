-- Run once in Cloudflare D1 Console for netibharatam-db.
-- Existing posts will be categorized as Nifty by default.
ALTER TABLE posts ADD COLUMN category TEXT NOT NULL DEFAULT 'nifty';
CREATE INDEX IF NOT EXISTS idx_posts_category_status ON posts(category, status);
