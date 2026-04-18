-- 018: place_audit_log.actor_type — 사람/파이프라인 구분 (T-068)
-- 목적: 감사 로그 UI 에서 수동 편집과 자동 파이프라인 변경을 시각적으로
--        구분하고, 향후 'pipeline 이 과도하게 활동하는 업체' 탐지의 기반.

alter table place_audit_log
  add column if not exists actor_type text not null default 'human';

-- 'human' | 'pipeline' | 'system' 허용. CHECK 는 값이 다양해질 수 있으므로 생략.
create index if not exists idx_audit_actor_type
  on place_audit_log(actor_type);
