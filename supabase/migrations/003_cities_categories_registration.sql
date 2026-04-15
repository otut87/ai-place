-- 003: cities, categories 테이블 + 업체 셀프 등록 지원
-- 하드코딩 → DB 이관, owner 연결, 승인 상태 관리

-- ===== cities 테이블 =====
create table if not exists cities (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  name_en text not null,
  created_at timestamptz not null default now()
);

alter table cities enable row level security;

drop policy if exists "cities_read" on cities;
create policy "cities_read" on cities for select using (true);

drop policy if exists "cities_insert" on cities;
create policy "cities_insert" on cities for insert with check (
  (select auth.role()) = 'service_role'
);

-- ===== categories 테이블 =====
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  name_en text not null,
  icon text,
  created_at timestamptz not null default now()
);

alter table categories enable row level security;

drop policy if exists "categories_read" on categories;
create policy "categories_read" on categories for select using (true);

drop policy if exists "categories_insert" on categories;
create policy "categories_insert" on categories for insert with check (
  (select auth.role()) = 'service_role'
);

-- ===== places 테이블 확장: owner + status =====

-- 업체 소유자 (Supabase Auth user → places 연결)
alter table places add column if not exists owner_id uuid references auth.users(id) on delete set null;
create index if not exists idx_places_owner_id on places(owner_id);

-- 승인 상태: active(공개), pending(검수 대기), rejected(반려)
alter table places add column if not exists status text not null default 'active'
  check (status in ('active', 'pending', 'rejected'));
create index if not exists idx_places_status on places(status);

-- ===== owner RLS: 소유자가 자기 업체 수정 가능 =====
drop policy if exists "places_owner_update" on places;
create policy "places_owner_update" on places for update using (
  owner_id = auth.uid()
);

-- 소유자가 자기 업체 insert (pending 상태로)
drop policy if exists "places_owner_insert" on places;
create policy "places_owner_insert" on places for insert with check (
  owner_id = auth.uid() and status = 'pending'
);
