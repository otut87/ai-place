-- 011: blog_posts 테이블 확장 (T-010a)
-- 기존 블로그 시스템(004)을 통합 블로그 라우트(/blog/[city]/[sector]/[slug])용으로 확장.
-- 추가: sector, post_type, related_place_slugs, target_query, faqs, statistics, sources,
--       view_count, quality_score
-- 변경: status check (draft/published) → (draft/active/archived) + 'published' 행 'active' 매핑.

-- 1) 컬럼 추가 (멱등) -----------------------------------------------------
alter table blog_posts add column if not exists sector text;
alter table blog_posts add column if not exists post_type text;
alter table blog_posts add column if not exists related_place_slugs text[] default '{}'::text[];
alter table blog_posts add column if not exists target_query text;
alter table blog_posts add column if not exists faqs jsonb not null default '[]'::jsonb;
alter table blog_posts add column if not exists statistics jsonb not null default '[]'::jsonb;
alter table blog_posts add column if not exists sources jsonb not null default '[]'::jsonb;
alter table blog_posts add column if not exists view_count integer not null default 0;
alter table blog_posts add column if not exists quality_score integer;

-- 2) sector / post_type 백필 (기존 행이 있을 경우 안전한 기본값 부여) ----
update blog_posts set sector = 'general' where sector is null;
update blog_posts set post_type = 'general' where post_type is null;
update blog_posts set related_place_slugs = '{}'::text[] where related_place_slugs is null;

-- 3) sector NOT NULL + post_type NOT NULL + check 추가 -------------------
alter table blog_posts alter column sector set not null;
alter table blog_posts alter column post_type set not null;

alter table blog_posts drop constraint if exists blog_posts_post_type_check;
alter table blog_posts add constraint blog_posts_post_type_check
  check (post_type in ('keyword', 'compare', 'guide', 'general'));

-- 4) status enum 마이그레이션: published → active, check 재정의 ---------
update blog_posts set status = 'active' where status = 'published';

alter table blog_posts drop constraint if exists blog_posts_status_check;
alter table blog_posts add constraint blog_posts_status_check
  check (status in ('draft', 'active', 'archived'));

-- 5) 인덱스 ---------------------------------------------------------------
create index if not exists idx_blog_posts_city_sector on blog_posts(city, sector);
create index if not exists idx_blog_posts_related_places on blog_posts using gin(related_place_slugs);

-- 6) RLS 정책 갱신 (status='active' 기준) -------------------------------
drop policy if exists "blog_posts_read" on blog_posts;
create policy "blog_posts_read" on blog_posts for select using (
  status = 'active' or (select auth.role()) = 'service_role'
);
