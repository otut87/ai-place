-- 019: places.field_meta — 필드별 출처·신뢰도 메타 (T-069)
-- 목적: AI 가 생성한 필드인지 사람이 직접 입력한 필드인지, 신뢰도는 얼마인지
--        UI 뱃지로 표시하기 위해 각 필드의 메타를 JSONB 1 컬럼에 보관.
--
-- 구조 예시:
--   {
--     "description":         { "source": "ai:sonnet-4-6", "confidence": 0.82, "generated_at": "2026-04-18T..." },
--     "services":            { "source": "manual", "generated_at": "2026-04-18T..." },
--     "faqs":                { "source": "ai:sonnet-4-6", "confidence": 0.78, "generated_at": "..." }
--   }
--
-- 원칙: 컬럼 산포 금지 — 필드별로 별도 컬럼을 만들지 않고 JSONB 하나에 통합.

alter table places add column if not exists field_meta jsonb;

-- AI 생성 비율 대시보드용 부분 인덱스 (선택)
create index if not exists idx_places_field_meta_gin
  on places using gin (field_meta);
