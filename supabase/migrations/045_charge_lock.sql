-- T-224 — 결제 충전 advisory lock.
--
-- 문제: 오너 수동 재시도와 크론이 동시에 같은 subscription 에 대해 charge 를 시도할 수 있음.
--   Toss orderId dedupe 로 결제 자체는 1건만 성공하지만, subscription UPDATE 가 race.
--
-- 해결: subscriptions.charging_started_at 을 advisory lock 으로 사용.
--   1) charge 시작 전 UPDATE ... SET charging_started_at=now()
--      WHERE id=? AND (charging_started_at IS NULL OR charging_started_at < now() - interval '60 seconds')
--   2) 0 rows → 이미 다른 프로세스가 charging 중. skip.
--   3) charge 완료 → UPDATE ... SET charging_started_at=NULL
--
-- 동시에 rate limit(5분 1회) 에도 활용 가능 — charging_started_at 이 5분 이내이면 재시도 거부.

alter table subscriptions
  add column if not exists charging_started_at timestamptz;

create index if not exists idx_subscriptions_charging
  on subscriptions(charging_started_at)
  where charging_started_at is not null;
