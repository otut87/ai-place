-- 013: AI 생성 호출 로깅 + places.quality_score (T-027/T-028)
-- 목적: 모델 호출 비용·지연·품질을 누적 관측하여
--        프롬프트·모델 교체 판단 근거를 확보한다.

-- 13.1 places.quality_score — 저장된 콘텐츠의 최신 품질 스코어 (T-027)
alter table places add column if not exists quality_score integer;

-- 13.2 ai_generations — 호출 단위 로그 (T-028)
create table if not exists ai_generations (
  id uuid primary key default gen_random_uuid(),
  place_id uuid references places(id) on delete set null,
  stage text not null,                      -- 'preprocess' | 'content' | 'recommendation' | ...
  model text not null,                      -- e.g. 'claude-sonnet-4-6'
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  latency_ms integer not null default 0,
  quality_score integer,                    -- 해당 호출 직후 측정된 품질 (옵션)
  retried integer not null default 0,       -- 재시도 횟수
  created_at timestamptz not null default now()
);

-- 조회 패턴: place 별 시계열 / 일별 집계
create index if not exists idx_ai_generations_place_id on ai_generations(place_id);
create index if not exists idx_ai_generations_created_at on ai_generations(created_at desc);

-- RLS: 어드민(service role) 전용 — 일반 사용자 접근 불가
alter table ai_generations enable row level security;

-- service_role 은 RLS 우회하므로 별도 정책 불필요. 안전장치로 모든 select/insert 는 차단.
-- (이미 정책이 없으면 기본 deny)
