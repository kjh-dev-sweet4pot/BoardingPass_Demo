-- SNS 업로드 시각 (Apify). 검수 제출 submitted_at 과 분리.
alter table public.creator_links
  add column if not exists published_at timestamptz;
