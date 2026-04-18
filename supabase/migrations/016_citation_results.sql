-- 016: citation_results 보조 인덱스 (H-01)
-- 목적: 001_initial_schema.sql 이 이미 citation_results 테이블을 생성했으므로
--        중복 생성 금지. 대시보드 조회·필터 패턴에 필요한 인덱스만 추가한다.
--
-- 001 스키마 (참고):
--   prompt_id uuid NOT NULL REFERENCES test_prompts(id)
--   cited_sources text[], cited_places text[]  — jsonb 아님
--   session_id text NOT NULL

-- 최근 N일 슬라이스 성능 — created_at DESC 스캔
create index if not exists idx_citation_results_tested_at_desc
  on citation_results(tested_at desc);

-- aiplace_cited = true 만 보는 쿼리(대시보드 성공 건) 용 partial 인덱스
create index if not exists idx_citation_results_aiplace_cited_partial
  on citation_results(tested_at desc)
  where aiplace_cited;
