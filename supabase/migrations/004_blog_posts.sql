-- 004: blog_posts 테이블 — 블로그 자동화 (크론 + LLM)
-- 도시/카테고리별 SEO/GEO 콘텐츠 자동 생성·게시

create table if not exists blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  summary text not null default '',
  content text not null,
  city text not null,
  category text,
  tags text[] not null default '{}',
  status text not null default 'draft'
    check (status in ('draft', 'published')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 인덱스
create index if not exists idx_blog_posts_city on blog_posts(city);
create index if not exists idx_blog_posts_status on blog_posts(status);
create index if not exists idx_blog_posts_published_at on blog_posts(published_at);

-- updated_at 자동 업데이트
drop trigger if exists blog_posts_updated_at on blog_posts;
create trigger blog_posts_updated_at
  before update on blog_posts
  for each row execute function update_updated_at();

-- RLS
alter table blog_posts enable row level security;

-- 공개 읽기 (published만)
drop policy if exists "blog_posts_read" on blog_posts;
create policy "blog_posts_read" on blog_posts for select using (
  status = 'published' or (select auth.role()) = 'service_role'
);

-- service_role만 쓰기
drop policy if exists "blog_posts_insert" on blog_posts;
create policy "blog_posts_insert" on blog_posts for insert with check (
  (select auth.role()) = 'service_role'
);

drop policy if exists "blog_posts_update" on blog_posts;
create policy "blog_posts_update" on blog_posts for update using (
  (select auth.role()) = 'service_role'
);
