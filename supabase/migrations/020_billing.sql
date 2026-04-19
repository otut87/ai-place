-- 020: billing — 구독·빌링키·결제 기록 (T-070)
-- 상품: 월 33,000원 정기결제 단일 상품. PG 는 토스페이먼츠.
-- 원칙: service role 전용 RLS. 사장님 셀프 포털(T-054)에서 본인 구독만 select.

-- 1) customers — 결제 주체
create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text,
  phone text,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_customers_user_id on customers(user_id);

-- 2) billing_keys — PG 빌링키 (카드당 1건)
create table if not exists billing_keys (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  provider text not null default 'toss',          -- 'toss' | 'mock'
  billing_key text not null,                      -- PG 빌링키 (토스: billingKey)
  method text,                                    -- '카드' 등
  card_company text,
  card_number_masked text,                         -- '1234-****-****-5678'
  card_type text,                                 -- 'credit' | 'check'
  expiry_year int,                                -- YYYY
  expiry_month int,                               -- 1~12
  status text not null default 'active',          -- 'active' | 'revoked' | 'expired'
  authenticated_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_billing_keys_customer on billing_keys(customer_id);
create index if not exists idx_billing_keys_status on billing_keys(status);
create index if not exists idx_billing_keys_expiry
  on billing_keys(expiry_year, expiry_month) where status = 'active';

-- 3) subscriptions — 구독 단위 (1 고객 = 1 구독 기본, 확장 여지)
create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  billing_key_id uuid references billing_keys(id) on delete set null,
  plan text not null default 'standard',          -- 'standard' = 월 33,000원
  amount int not null default 33000,              -- 원 단위
  status text not null default 'pending',         -- 'pending' | 'active' | 'past_due' | 'suspended' | 'canceled'
  started_at timestamptz,
  next_charge_at timestamptz,
  canceled_at timestamptz,
  cancel_reason text,
  failed_retry_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_subscriptions_customer on subscriptions(customer_id);
create index if not exists idx_subscriptions_status on subscriptions(status);
create index if not exists idx_subscriptions_next_charge
  on subscriptions(next_charge_at) where status in ('active', 'past_due');

-- 4) payments — 승인·실패 기록 (append-only)
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references subscriptions(id) on delete cascade,
  billing_key_id uuid references billing_keys(id) on delete set null,
  amount int not null,
  status text not null,                           -- 'succeeded' | 'failed' | 'canceled'
  pg_payment_key text,                            -- 토스: paymentKey
  pg_order_id text not null,                      -- 멱등키
  pg_response_code text,                          -- '실패 코드'
  pg_response_message text,
  retried_count int not null default 0,           -- 재시도 순번 (0 = 첫 시도)
  attempted_at timestamptz not null default now(),
  succeeded_at timestamptz
);

create unique index if not exists idx_payments_pg_order_id on payments(pg_order_id);
create index if not exists idx_payments_subscription on payments(subscription_id);
create index if not exists idx_payments_status on payments(status);
create index if not exists idx_payments_attempted_desc on payments(attempted_at desc);
-- T-073 결제 실패 큐 전용 부분 인덱스
create index if not exists idx_payments_failed_partial
  on payments(attempted_at desc) where status = 'failed';

-- 5) places.customer_id — 업체 ↔ 고객 연결 (1 고객이 여러 업체 보유 가능)
alter table places add column if not exists customer_id uuid references customers(id) on delete set null;
create index if not exists idx_places_customer on places(customer_id);

-- 6) RLS: service role 전용 (사장님 포털은 별도 정책으로 확장)
alter table customers enable row level security;
alter table billing_keys enable row level security;
alter table subscriptions enable row level security;
alter table payments enable row level security;

-- 사장님 본인 구독 조회 (T-054 셀프 포털)
drop policy if exists "customers_self_select" on customers;
create policy "customers_self_select" on customers for select
  using (user_id = auth.uid());

drop policy if exists "subscriptions_self_select" on subscriptions;
create policy "subscriptions_self_select" on subscriptions for select
  using (customer_id in (select id from customers where user_id = auth.uid()));

drop policy if exists "billing_keys_self_select" on billing_keys;
create policy "billing_keys_self_select" on billing_keys for select
  using (customer_id in (select id from customers where user_id = auth.uid()));

drop policy if exists "payments_self_select" on payments;
create policy "payments_self_select" on payments for select
  using (subscription_id in (
    select s.id from subscriptions s
    join customers c on c.id = s.customer_id
    where c.user_id = auth.uid()
  ));
