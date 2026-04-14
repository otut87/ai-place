-- AI Place — Initial Schema
-- 업체 데이터 + AI 인용 테스트 결과 저장

-- 업체 (places)
create table if not exists places (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  name text not null,
  name_en text,
  city text not null,
  category text not null,
  description text not null,
  address text not null,
  phone text,
  opening_hours text[],
  image_url text,
  rating numeric(2,1),
  review_count integer default 0,
  services jsonb not null default '[]'::jsonb,
  faqs jsonb not null default '[]'::jsonb,
  tags text[] not null default '{}',
  naver_place_url text,
  kakao_map_url text,
  latitude numeric(9,6),
  longitude numeric(9,6),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(city, category, slug)
);

-- AI 테스트 프롬프트
create table if not exists test_prompts (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  category text not null,
  city text not null,
  created_at timestamptz not null default now()
);

-- AI 인용 결과
create table if not exists citation_results (
  id uuid primary key default gen_random_uuid(),
  prompt_id uuid not null references test_prompts(id) on delete cascade,
  engine text not null check (engine in ('chatgpt', 'claude', 'gemini')),
  response text not null,
  cited_sources text[] not null default '{}',
  cited_places text[] not null default '{}',
  aiplace_cited boolean not null default false,
  session_id text not null,
  tested_at timestamptz not null default now()
);

-- 인덱스
create index if not exists idx_places_city_category on places(city, category);
create index if not exists idx_citation_results_prompt on citation_results(prompt_id);
create index if not exists idx_citation_results_engine on citation_results(engine);
create index if not exists idx_citation_results_tested_at on citation_results(tested_at);

-- updated_at 자동 업데이트 트리거
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists places_updated_at on places;
create trigger places_updated_at
  before update on places
  for each row execute function update_updated_at();

-- RLS 정책 (anon 읽기 허용, service_role만 쓰기)
alter table places enable row level security;
alter table test_prompts enable row level security;
alter table citation_results enable row level security;

-- 공개 읽기
drop policy if exists "places_read" on places;
create policy "places_read" on places for select using (true);
drop policy if exists "prompts_read" on test_prompts;
create policy "prompts_read" on test_prompts for select using (true);
drop policy if exists "citations_read" on citation_results;
create policy "citations_read" on citation_results for select using (true);

-- service_role만 쓰기 (anon 키로는 쓰기 불가)
drop policy if exists "places_insert" on places;
create policy "places_insert" on places for insert with check (
  (select auth.role()) = 'service_role'
);
drop policy if exists "places_update" on places;
create policy "places_update" on places for update using (
  (select auth.role()) = 'service_role'
);
drop policy if exists "prompts_insert" on test_prompts;
create policy "prompts_insert" on test_prompts for insert with check (
  (select auth.role()) = 'service_role'
);
drop policy if exists "citations_insert" on citation_results;
create policy "citations_insert" on citation_results for insert with check (
  (select auth.role()) = 'service_role'
);
