-- 016: citation_results — AI 인용 추적 (T-056)
-- 목적: scripts/baseline-test.ts 가 각 AI 엔진에 프롬프트를 던져 얻은 응답을
--        저장하고, 시간 추이·업체별 인용 빈도를 어드민에서 관찰한다.

create table if not exists citation_results (
  id uuid primary key default gen_random_uuid(),
  prompt_id text not null,                     -- 'cheonan-dermatology-top', 'cheonan-pet-hospital', ...
  engine text not null,                        -- 'chatgpt' | 'claude' | 'gemini'
  session_id text,                             -- 같은 세션·runId 를 그룹핑
  response text not null,                      -- AI 전체 응답
  cited_sources jsonb,                         -- string[] URL 목록
  cited_places jsonb,                          -- string[] 언급 업체명
  aiplace_cited boolean not null default false,
  tested_at timestamptz not null default now()
);

create index if not exists idx_citations_prompt on citation_results(prompt_id);
create index if not exists idx_citations_engine on citation_results(engine);
create index if not exists idx_citations_tested_at on citation_results(tested_at desc);
create index if not exists idx_citations_aiplace_cited on citation_results(aiplace_cited) where aiplace_cited;

alter table citation_results enable row level security;
-- service role 만 읽기/쓰기 — 일반 사용자 기본 deny.
