-- T-229 — 쿠폰 시스템.
--
-- 정책 (autoplan Eng 리뷰 반영):
--   - 1 customer × 1 coupon: UNIQUE(coupon_id, customer_id)
--   - Per-charge override: 쿠폰은 "다음 결제 1회" 만 적용. subscription.amount 에
--     영구 반영하지 않고 charge 시점에만 discount 적용.
--   - applied_payment_id 가 설정되면 redemption 소진. stacking 금지는 "customer 의
--     unapplied redemption 1개 제한" 으로 구현.
--   - 만료/잔여 횟수 검증: 등록 시점과 charge 시점에 각각 재검증 (TOCTOU 방어).
--
-- percent 할인 계산: floor(amount * (100 - discount_value) / 100)
-- fixed 할인 계산:   max(0, amount - discount_value)

-- 1) coupons — 발급 가능한 쿠폰 정의
create table if not exists coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  discount_type text not null check (discount_type in ('percent', 'fixed')),
  discount_value int not null check (discount_value > 0),
  valid_from timestamptz not null default now(),
  valid_until timestamptz,                           -- null = 무제한
  max_uses int,                                      -- null = 무제한
  uses_count int not null default 0,
  note text,                                         -- 관리자 메모 (캠페인명 등)
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create index if not exists idx_coupons_code on coupons(code);
create index if not exists idx_coupons_valid on coupons(valid_until) where valid_until is not null;

-- 2) coupon_redemptions — 쿠폰 사용 기록
create table if not exists coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references coupons(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  -- 쿠폰 차감이 실제 payment 에 적용된 시점.
  -- null 이면 "미적용" 상태 — 다음 charge 에서 소진됨.
  applied_payment_id uuid references payments(id) on delete set null,
  applied_at timestamptz,
  unique(coupon_id, customer_id)
);

create index if not exists idx_coupon_redemptions_customer_unapplied
  on coupon_redemptions(customer_id)
  where applied_payment_id is null;
create index if not exists idx_coupon_redemptions_coupon
  on coupon_redemptions(coupon_id);

-- 3) RLS — 오너는 자기 customer_id 의 redemption 만 조회, coupon 테이블은 admin only.
alter table coupons enable row level security;
alter table coupon_redemptions enable row level security;

-- admin (service_role) 는 RLS 우회 — 정책 선언 불필요.
-- owner select: 자기 redemption 만
create policy coupon_redemptions_owner_select on coupon_redemptions
  for select
  using (
    customer_id in (
      select id from customers where user_id = auth.uid()
    )
  );
-- coupons 자체는 아무도 select 못 함 (admin service_role 만 가능). owner 는
-- redeem 서버 액션을 통해 code 로만 검증.
