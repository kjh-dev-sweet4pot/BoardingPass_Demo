-- ============================================================
-- OWM 인플루언서 마케팅 리포트 - Supabase Schema
-- ============================================================

-- 1. contents 테이블 (핵심 단일 테이블)
CREATE TABLE IF NOT EXISTS contents (
  id              BIGSERIAL PRIMARY KEY,
  created_at      TIMESTAMPTZ DEFAULT NOW(),

  -- 캠페인 분류
  campaign        TEXT NOT NULL,          -- '명동오픈_0811' | '남포오픈' | '신사메가_6월' 등
  location        TEXT NOT NULL,          -- '명동점' | '남포점' | '신사점' 등
  brands          TEXT,                   -- '닥터리엔장,텔로엑트,옵티팜,이뮨'

  -- 인플루언서
  influencer_name TEXT NOT NULL,
  sns_id          TEXT,
  profile_url     TEXT,
  channel         TEXT NOT NULL,          -- '샤오홍슈' | '인스타그램' | '틱톡' | '도우인' | '웨이보'
  follower_count  INTEGER,
  target_audience TEXT,                   -- '미국, 이란' (메가 인플루언서용)
  is_press        BOOLEAN DEFAULT FALSE,  -- 기자단 여부

  -- 방문/업로드. 월 분류는 visit_date (YYYY-MM). 별도 month 컬럼 없음
  visit_date      DATE,
  product         TEXT,
  upload_url      TEXT,
  publish_status  TEXT NOT NULL DEFAULT '예정',  -- '예정' | '진행중' | '발행완료'

  -- 성과 지표
  views           INTEGER,    -- 조회수 (없으면 NULL)
  likes           INTEGER,    -- 좋아요
  saves           INTEGER,    -- 저장/수집
  comments        INTEGER,    -- 댓글

  -- 추정 조회수 (캘리브레이션 후 채워넣는 컬럼)
  views_estimated INTEGER,        -- 추정 조회수 중앙값
  views_est_low   INTEGER,        -- 추정 하한
  views_est_high  INTEGER,        -- 추정 상한
  views_source    TEXT DEFAULT 'none',  -- 'measured' | 'estimated' | 'none'
  metrics_updated_at TIMESTAMPTZ,      -- Apify 마지막 동기화 시각
  profile_image_url TEXT                -- Supabase Storage 공개 URL
);

-- 2. 성과 등급 자동 계산 뷰
CREATE OR REPLACE VIEW contents_with_performance AS
WITH stats AS (
  SELECT
    campaign,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY likes + COALESCE(saves,0) + COALESCE(comments,0)) AS median_interaction
  FROM contents
  WHERE likes IS NOT NULL
  GROUP BY campaign
)
SELECT
  c.*,
  -- 상호작용 합계
  COALESCE(c.likes,0) + COALESCE(c.saves,0) + COALESCE(c.comments,0) AS total_interaction,
  -- 실측 또는 추정 조회수 (샤오홍슈·도우인은 역산 우선 — 인스타 실측 혼입 방지)
  COALESCE(
    CASE WHEN c.channel IN ('샤오홍슈', '도우인') THEN c.views_estimated ELSE c.views END,
    c.views,
    c.views_estimated
  ) AS views_best,
  -- 성과 등급
  CASE
    WHEN c.likes IS NULL THEN 'no_data'
    WHEN (COALESCE(c.likes,0) + COALESCE(c.saves,0) + COALESCE(c.comments,0))
         >= s.median_interaction * 1.2 THEN 'high'
    WHEN (COALESCE(c.likes,0) + COALESCE(c.saves,0) + COALESCE(c.comments,0))
         >= s.median_interaction * 0.8 THEN 'mid'
    ELSE 'low'
  END AS performance
FROM contents c
LEFT JOIN stats s ON c.campaign = s.campaign;

-- 3. 요약 뷰 (스냅샷용)
CREATE OR REPLACE VIEW summary AS
SELECT
  COUNT(*)                                          AS total_rows,
  COUNT(DISTINCT influencer_name)                   AS total_influencers,
  COUNT(CASE WHEN upload_url IS NOT NULL THEN 1 END) AS uploaded,
  SUM(
    CASE WHEN channel IN ('샤오홍슈', '도우인') THEN COALESCE(views_estimated, views, 0)
         ELSE COALESCE(views, views_estimated, 0) END
  ) AS total_views,
  SUM(COALESCE(likes,0))                            AS total_likes,
  SUM(COALESCE(saves,0))                            AS total_saves,
  SUM(COALESCE(comments,0))                         AS total_comments
FROM contents;

-- 4. 지점별 집계 뷰
CREATE OR REPLACE VIEW location_summary AS
SELECT
  location,
  COUNT(DISTINCT influencer_name) AS influencer_count,
  COUNT(CASE WHEN upload_url IS NOT NULL THEN 1 END) AS uploaded,
  SUM(COALESCE(likes,0)) AS total_likes,
  SUM(COALESCE(saves,0)) AS total_saves,
  MAX(COALESCE(views, views_estimated)) AS max_views
FROM contents
GROUP BY location
ORDER BY total_likes DESC;

-- 5. Row Level Security (공개 읽기 — 로그인 없이 리포트 조회)
ALTER TABLE contents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated users can read" ON contents;
DROP POLICY IF EXISTS "public read" ON contents;

CREATE POLICY "public read"
  ON contents FOR SELECT
  TO anon, authenticated
  USING (true);

GRANT SELECT ON contents TO anon, authenticated;
GRANT SELECT ON contents_with_performance TO anon, authenticated;
GRANT SELECT ON summary TO anon, authenticated;
GRANT SELECT ON location_summary TO anon, authenticated;

-- 6. 인덱스
CREATE INDEX IF NOT EXISTS idx_contents_campaign  ON contents(campaign);
CREATE INDEX IF NOT EXISTS idx_contents_location  ON contents(location);
CREATE INDEX IF NOT EXISTS idx_contents_channel   ON contents(channel);
CREATE INDEX IF NOT EXISTS idx_contents_is_press  ON contents(is_press);
CREATE INDEX IF NOT EXISTS idx_contents_views     ON contents(views DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_contents_likes     ON contents(likes DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_contents_visit_date ON contents(visit_date);
CREATE INDEX IF NOT EXISTS idx_contents_publish_status ON contents(publish_status);

ALTER TABLE contents DROP CONSTRAINT IF EXISTS contents_publish_status_check;
ALTER TABLE contents ADD CONSTRAINT contents_publish_status_check
  CHECK (publish_status IN ('예정', '진행중', '발행완료'));

-- 7. 월 목표 숫자만. 인원은 contents.visit_date + publish_status
CREATE TABLE IF NOT EXISTS monthly_goals (
  month         DATE PRIMARY KEY,
  upload_target INTEGER NOT NULL CHECK (upload_target >= 0),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE monthly_goals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public read" ON monthly_goals;
CREATE POLICY "public read" ON monthly_goals FOR SELECT TO anon, authenticated USING (true);
GRANT SELECT ON monthly_goals TO anon, authenticated;

-- 8. 회원사·월별 예산. 원본은 보딩패스. 금액은 원.
-- 기존 DB는 supabase/add-companies.sql 을 SQL editor에서 한 번 실행.
