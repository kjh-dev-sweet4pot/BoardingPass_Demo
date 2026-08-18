-- creator_links: TikTok oEmbed 썸네일 + (2단계) 지표 갱신용 컬럼
-- Supabase SQL editor에서 실행

ALTER TABLE creator_links
  ADD COLUMN IF NOT EXISTS thumbnail_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS thumbnail_mime text,
  ADD COLUMN IF NOT EXISTS thumbnail_bytes bytea,
  ADD COLUMN IF NOT EXISTS thumbnail_source_url text,
  ADD COLUMN IF NOT EXISTS thumbnail_fetched_at timestamptz,
  ADD COLUMN IF NOT EXISTS tiktok_video_id text,
  ADD COLUMN IF NOT EXISTS views bigint,
  ADD COLUMN IF NOT EXISTS likes integer,
  ADD COLUMN IF NOT EXISTS comments integer,
  ADD COLUMN IF NOT EXISTS metrics_collected_at timestamptz;

COMMENT ON COLUMN creator_links.thumbnail_status IS 'pending | ok | failed';
COMMENT ON COLUMN creator_links.thumbnail_bytes IS 'oEmbed CDN 이미지 복사본 (TTL 우회)';
