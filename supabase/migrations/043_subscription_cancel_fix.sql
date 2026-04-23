-- T-220.5 — subscription cancel flow 버그 fix
--
-- Pre-existing 버그:
-- 1. subscription-cancel.ts 가 `updates.cancelled_at` (LL) 컬럼에 write 하지만
--    migration 020 의 실제 컬럼명은 `canceled_at` (L). PostgREST 42703 error 로
--    모든 즉시 해지 요청 실패해 옴.
-- 2. `updates.pending_cancel_at` 컬럼 자체가 schema 에 없음. end_of_period 해지도 실패.
-- 3. status 문자열 `'cancelled'` (LL) 과 enum 주석의 `'canceled'` (L) 불일치.
--    CHECK constraint 는 없어 silently 저장되지만 billing-state.ts 필터에서
--    둘 다 의도치 않게 제외됨.
--
-- Fix:
-- - pending_cancel_at 컬럼 추가
-- - status CHECK constraint 추가 ('pending', 'active', 'past_due', 'suspended',
--   'canceled', 'pending_cancellation' 6개만 허용) → 향후 오타 즉시 에러화
-- - 기존 오타 'cancelled' 행이 있으면 'canceled' 로 backfill

-- 1) pending_cancel_at 컬럼 추가
alter table subscriptions
  add column if not exists pending_cancel_at timestamptz;

create index if not exists idx_subscriptions_pending_cancel
  on subscriptions(pending_cancel_at) where pending_cancel_at is not null;

-- 2) 기존 오타 backfill (없으면 no-op)
update subscriptions
  set status = 'canceled'
  where status = 'cancelled';

-- 3) status CHECK constraint — 오타 재발 방지
alter table subscriptions
  drop constraint if exists subscriptions_status_check;

alter table subscriptions
  add constraint subscriptions_status_check
  check (status in (
    'pending',
    'active',
    'past_due',
    'suspended',
    'canceled',
    'pending_cancellation'
  ));
