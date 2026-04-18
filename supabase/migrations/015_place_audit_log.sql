-- 015: place_audit_log — 업체 변경 이력·감사 로그 (T-055)
-- 목적: 업체 생성/수정/삭제/상태 변경을 append-only 로 기록하여
--        롤백·감사·의심 활동 추적 기반을 제공한다.

create table if not exists place_audit_log (
  id uuid primary key default gen_random_uuid(),
  place_id uuid references places(id) on delete set null,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,                       -- 'create' | 'update' | 'status' | 'delete' | 'restore'
  field text,                                 -- update 시 대상 필드 (null 이면 전체)
  before_value jsonb,                         -- 변경 전 값(스냅샷 가능)
  after_value jsonb,                          -- 변경 후 값
  reason text,                                -- 작업자 기입 사유 (선택)
  created_at timestamptz not null default now()
);

create index if not exists idx_place_audit_place_id on place_audit_log(place_id);
create index if not exists idx_place_audit_created_at on place_audit_log(created_at desc);
create index if not exists idx_place_audit_action on place_audit_log(action);

-- RLS: service role 전용. 일반 사용자는 읽기/쓰기 불가.
alter table place_audit_log enable row level security;
