-- 021: pipeline_jobs — 자동화 작업 모니터링 (T-076)
-- 수집·생성·발행 등 백그라운드 파이프라인의 성공/실패를 집계.
-- LLM 토큰·비용은 기존 ai_generations(013) 를 그대로 재사용 — 컬럼 산포 금지.

create table if not exists pipeline_jobs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null,                          -- 'collect' | 'generate' | 'publish' | 'backfill' ...
  target_type text,                                -- 'place' | 'blog_post'
  target_id uuid,
  status text not null default 'pending',          -- 'pending' | 'running' | 'succeeded' | 'failed' | 'canceled'
  input_payload jsonb,                             -- 재시도를 위한 원본 입력
  result_payload jsonb,                            -- 결과 요약
  error text,
  retried_count int not null default 0,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_pipeline_jobs_status on pipeline_jobs(status);
create index if not exists idx_pipeline_jobs_type on pipeline_jobs(job_type);
create index if not exists idx_pipeline_jobs_created_desc on pipeline_jobs(created_at desc);
-- 실패 큐 전용 부분 인덱스
create index if not exists idx_pipeline_jobs_failed_partial
  on pipeline_jobs(created_at desc) where status = 'failed';

alter table pipeline_jobs enable row level security;
