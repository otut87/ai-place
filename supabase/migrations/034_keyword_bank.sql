-- 034: 키워드 뱅크 (T-194 / Phase 2)
-- 83 sector × 6 angle × 25 ≈ 12,500 타깃 키워드 풀 + 쿨다운/라운드로빈 발급.
-- Jaccard + FOR UPDATE SKIP LOCKED 로 중복·경합 방어 (관리 로직은 src/lib/blog/keyword-bank.ts).

-- ============================================================
-- 1) keyword_bank — 타깃 키워드 풀
-- ============================================================
create table if not exists keyword_bank (
  id uuid primary key default gen_random_uuid(),
  keyword text not null,
  sector text not null,
  city text,                                -- null = 도시 무관 일반 키워드
  angle text,                               -- review-deepdive / price-transparency / ...
  post_type text,                           -- detail / compare / guide / keyword
  priority int not null default 5,          -- 1(최상)~10(최하) — Phase 5 GSC 피드백으로 조정
  competition text,                          -- low / medium / high
  longtails text[] not null default '{}'::text[],
  source text not null default 'llm_generated',   -- llm_generated | manual | gsc_import
  validated_at timestamptz,
  last_used_at timestamptz,
  used_count int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  -- 동일 (keyword, sector, city) 조합 중복 금지 — city NULL 도 하나의 슬롯
  unique (keyword, sector, city)
);

-- pickTargetQuery 핫패스 인덱스 — (sector, city, active) 조건 + (last_used_at NULLS FIRST, used_count) 정렬.
create index if not exists idx_keyword_bank_pick
  on keyword_bank (sector, city, active, last_used_at nulls first, used_count);

-- sector 단독 스캔(드문 seed 조회) 보조 인덱스
create index if not exists idx_keyword_bank_sector_active
  on keyword_bank (sector, active);

-- ============================================================
-- 2) keyword_bank_usage — 키워드-블로그 N:M 이력
-- ============================================================
create table if not exists keyword_bank_usage (
  id uuid primary key default gen_random_uuid(),
  keyword_id uuid not null references keyword_bank(id) on delete cascade,
  blog_post_id uuid references blog_posts(id) on delete set null,
  used_at timestamptz not null default now()
);

create index if not exists idx_keyword_bank_usage_keyword
  on keyword_bank_usage (keyword_id, used_at desc);

-- ============================================================
-- 3) blog_posts 확장 — 어떤 키워드·앵글로 생성됐는지 추적
-- ============================================================
alter table blog_posts add column if not exists target_query text;
alter table blog_posts add column if not exists keyword_id uuid references keyword_bank(id) on delete set null;
alter table blog_posts add column if not exists angle text;

-- angle 필터용 인덱스 (최근 30일 place+angle 조합 제외 쿼리 Phase 3 에서 사용)
create index if not exists idx_blog_posts_angle_created
  on blog_posts (angle, created_at desc)
  where angle is not null;

-- ============================================================
-- 4) RLS — keyword_bank / keyword_bank_usage 는 service role 만 쓰기.
--    (읽기도 관리자 전용이면 충분 — 공개 API 로 쓸 일 없음)
-- ============================================================
alter table keyword_bank enable row level security;
alter table keyword_bank_usage enable row level security;

drop policy if exists "keyword_bank admin read" on keyword_bank;
create policy "keyword_bank admin read"
  on keyword_bank for select
  using (auth.role() = 'service_role');

drop policy if exists "keyword_bank admin write" on keyword_bank;
create policy "keyword_bank admin write"
  on keyword_bank for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "keyword_bank_usage admin read" on keyword_bank_usage;
create policy "keyword_bank_usage admin read"
  on keyword_bank_usage for select
  using (auth.role() = 'service_role');

drop policy if exists "keyword_bank_usage admin write" on keyword_bank_usage;
create policy "keyword_bank_usage admin write"
  on keyword_bank_usage for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

comment on table keyword_bank is '블로그 타깃 키워드 풀 (Haiku 자동 생성 + 쿨다운/라운드로빈)';
comment on column keyword_bank.last_used_at is 'pickTargetQuery 시 nulls first 정렬 — 한 번도 안 쓴 키워드 우선';
comment on column keyword_bank.used_count is '라운드로빈 보조 — 사용 횟수 적은 순';
comment on column blog_posts.keyword_id is '발행 블로그가 사용한 키워드 뱅크 row (null 가능 — 수동 블로그 대응)';
comment on column blog_posts.angle is '6 Angle 중 하나 — review-deepdive / price-transparency / ...';

-- ============================================================
-- 5) pick_target_query() — 경합 방어 원자 발급 RPC
-- Supabase JS 는 트랜잭션·FOR UPDATE SKIP LOCKED 를 직접 쓸 수 없으므로
-- PL/pgSQL 함수로 감싸서 JS 는 admin.rpc('pick_target_query', ...) 로 호출.
-- 단일 호출 = 단일 트랜잭션 → FOR UPDATE SKIP LOCKED 가 자연스럽게 작동.
-- ============================================================
create or replace function pick_target_query(
  p_sector text,
  p_city text default null,
  p_angle text default null,
  p_post_type text default null
)
returns table (
  id uuid,
  keyword text,
  longtails text[],
  priority int,
  angle text,
  post_type text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  picked_id uuid;
begin
  -- 1) city 매칭 우선 — city is not distinct from null-safe equality.
  --    angle/post_type 은 지정됐을 때만 필터 적용 (null = 모두 허용).
  select kb.id into picked_id
  from keyword_bank kb
  where kb.sector = p_sector
    and kb.active = true
    and (p_city is null or kb.city is not distinct from p_city)
    and (p_angle is null or kb.angle = p_angle)
    and (p_post_type is null or kb.post_type = p_post_type)
  order by kb.last_used_at nulls first, kb.used_count asc, kb.priority asc
  limit 1
  for update skip locked;

  -- 2) city 매칭 결과 없으면 city=null (도시 무관) fallback 허용.
  if picked_id is null and p_city is not null then
    select kb.id into picked_id
    from keyword_bank kb
    where kb.sector = p_sector
      and kb.active = true
      and kb.city is null
      and (p_angle is null or kb.angle = p_angle)
      and (p_post_type is null or kb.post_type = p_post_type)
    order by kb.last_used_at nulls first, kb.used_count asc, kb.priority asc
    limit 1
    for update skip locked;
  end if;

  if picked_id is null then
    return;
  end if;

  -- 3) 원자 업데이트 — 동시 호출자가 이 row 를 다시 집을 수 없게 last_used_at/used_count 전진.
  update keyword_bank
  set last_used_at = now(),
      used_count = used_count + 1
  where keyword_bank.id = picked_id;

  return query
  select kb.id, kb.keyword, kb.longtails, kb.priority, kb.angle, kb.post_type
  from keyword_bank kb
  where kb.id = picked_id;
end;
$$;

comment on function pick_target_query(text, text, text, text) is
  'FOR UPDATE SKIP LOCKED 기반 키워드 원자 발급 — 동시 호출 시 중복 발급 0 보장.';

-- Supabase REST 의 service_role 은 기본적으로 function 호출 가능하지만 명시.
grant execute on function pick_target_query(text, text, text, text) to service_role;
