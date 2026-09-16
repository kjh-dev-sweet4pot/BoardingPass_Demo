repo: kjh-dev-sweet4pot/Slamworld
branch: main

## Last sync
date: 2026-09-15T05:40:00Z
### Updated in this project
- 레퍼런스(report.optimacare.co.kr) 구조를 이식한 리포트 개편 후보 3안 작성
- supabase/seed.sql 331행을 파싱해 지점·채널·월별·랭킹 실집계 추출 (data/agg.json)
- 샤오홍슈·도우인 조회수는 README 캘리브레이션(인터랙션율 2.3%)으로 역산

## Screen map
| 화면 | 레포 출처 |
| --- | --- |
| Slamworld 리포트 개편.dc.html (1a/1b/1c) | app/page.tsx, components/SnapshotBar.tsx, components/ChannelDonut.tsx, components/RegionDonut.tsx, lib/monthly-performance.ts, lib/types.ts |
| 수치 집계 (data/agg.json) | supabase/seed.sql, supabase/schema.sql, README.md |
