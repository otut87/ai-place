-- 040: place_mentions 매핑 + blog_posts.places_mentioned (Owner Dashboard Sprint D-1 / T-200)
--
-- 목적: "이 글에 어떤 업체가 편집적으로 언급됐는가"를 DB 수준에서 추적 →
-- bot_visits(page_path) ⟂ place_mentions 로 귀속 집계 (직접 vs 언급).
--
-- 채워지는 경로:
--   1) places.status='active'              → page_type='detail'   자체 URL fan-out
--   2) blog_posts.status='active'          → page_type='blog'     places_mentioned[] fan-out
--   3) seed ComparisonPage / GuidePage / KeywordPage
--                                           → page_type='compare' | 'guide' | 'keyword'
--                                             (scripts/sync-place-mentions.ts 가 upsert)
--
-- 리스팅/도시 랜딩/홈은 포함하지 않음 — 20곳 일괄 귀속 시 신호 품질 저하.

create table if not exists place_mentions (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references places(id) on delete cascade,
  page_path text not null,
  page_type text not null check (page_type in ('detail','blog','compare','guide','keyword')),
  created_at timestamptz not null default now(),
  unique (place_id, page_path)
);

create index if not exists idx_place_mentions_path on place_mentions (page_path);
create index if not exists idx_place_mentions_place on place_mentions (place_id);
create index if not exists idx_place_mentions_type on place_mentions (page_type);

alter table place_mentions enable row level security;

drop policy if exists "place_mentions_read" on place_mentions;
create policy "place_mentions_read" on place_mentions for select using (
  (select auth.role()) = 'service_role'
);

drop policy if exists "place_mentions_write" on place_mentions;
create policy "place_mentions_write" on place_mentions for all using (
  (select auth.role()) = 'service_role'
) with check (
  (select auth.role()) = 'service_role'
);

-- blog_posts: 파이프라인이 저장한 verifiedPlaces.id[] 를 보존 → fan-out 근거.
alter table blog_posts add column if not exists places_mentioned uuid[] not null default '{}'::uuid[];
create index if not exists idx_blog_posts_places_mentioned
  on blog_posts using gin (places_mentioned);

comment on table place_mentions is
  'page_path 와 place_id 매핑 — bot_visits 와 JOIN 해 언급 방문 집계. D-1 v4';
comment on column place_mentions.page_type is
  'detail: 업체 상세 / blog: blog_posts / compare: seed ComparisonPage / guide: GuidePage / keyword: KeywordPage';
comment on column blog_posts.places_mentioned is
  '파이프라인 verifiedPlaces.id[] 스냅샷. status=active 전환 시 place_mentions 로 fan-out.';
