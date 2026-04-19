-- 026: citation_tests — 업체별 AI 인용 실측 테스트 실행 트래커 (T-140)
-- 목적: 구독자 전용 주 1회 제한 (업체 단위).
-- 실제 테스트 결과는 citation_results (001) 에 누적, 이 테이블은 rate limit · 요약만.

create table if not exists citation_tests (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references places(id) on delete cascade,
  triggered_by text not null,              -- 'owner' | 'admin' | 'cron'
  engines text[] not null default '{}',    -- ['chatgpt', 'claude', 'gemini']
  queries_count int not null default 0,
  results_count int not null default 0,
  cited_count int not null default 0,      -- aiplace_cited=true 건수
  citation_rate numeric(5,4),              -- cited_count / results_count (0~1)
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists idx_citation_tests_place on citation_tests(place_id);
create index if not exists idx_citation_tests_started_desc on citation_tests(started_at desc);

-- 부분 인덱스 — 특정 업체의 가장 최근 실행 시각 빠른 조회
create index if not exists idx_citation_tests_place_latest
  on citation_tests(place_id, started_at desc);

alter table citation_tests enable row level security;
-- service_role 전용 (RLS 우회). 정책 없음 = 기본 deny.
