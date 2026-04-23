-- T-223.5 — 다중 카드 등록 지원: billing_keys.is_primary 컬럼 + partial unique index.
--
-- 정책 (2026-04-23 결정):
--   - customer 1명이 여러 카드 등록 가능
--   - 1장만 is_primary=true (charging 대상)
--   - subscription.billing_key_id = primary 카드의 id 로 자동 동기화
--   - 유일한 primary 카드는 삭제 불가 (다른 카드를 primary 로 먼저 설정)
--
-- 마이그레이션:
--   1) is_primary 컬럼 (default false)
--   2) 기존 활성 카드 각 customer 의 가장 최근 것을 primary 로 설정 (backfill)
--   3) partial unique index — active + is_primary 조합이 customer 당 최대 1개
--
-- Phase C (T-222) 에서 issueBillingKeyAction 을 이 스키마로 재작성.

alter table billing_keys
  add column if not exists is_primary boolean not null default false;

-- 2) backfill — 각 customer 의 가장 최근 active 카드를 primary 로.
--    (현재 스키마가 1 customer = 1 active card 전제였으므로 기존 행 마이그레이션은 단순함)
update billing_keys bk
  set is_primary = true
  where bk.status = 'active'
    and bk.id = (
      select bk2.id
      from billing_keys bk2
      where bk2.customer_id = bk.customer_id
        and bk2.status = 'active'
      order by bk2.authenticated_at desc
      limit 1
    );

-- 3) partial unique — customer 당 active + primary 카드 1개 제한.
create unique index if not exists billing_keys_one_primary_per_customer
  on billing_keys(customer_id)
  where is_primary = true and status = 'active';

-- 4) 조회 인덱스 — primary 카드 lookup 빠르게.
create index if not exists idx_billing_keys_primary
  on billing_keys(customer_id, is_primary)
  where is_primary = true;
