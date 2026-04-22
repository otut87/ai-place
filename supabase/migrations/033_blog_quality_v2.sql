-- 033: 블로그 품질 엔진 v2 (T-193 / Phase 1)
-- 결정론 16룰 기반 스코어/리포트 저장 + 하드 실패 추적.
-- 기존 quality_score(0~100) 의 상한 재확인(check constraint) + rules_report/hard_failures 컬럼 추가.

-- rulesReport: RuleResult[] 전체
alter table blog_posts add column if not exists quality_rules_report jsonb;

-- hard_failures: 서비어리티=fail 이면서 pass=false 인 룰 id 배열
alter table blog_posts add column if not exists hard_failures text[] default '{}'::text[];

-- quality_score 상한 0~100 재보장 (과거 제약 없던 경우 대비)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'blog_posts_quality_score_range'
  ) then
    alter table blog_posts
      add constraint blog_posts_quality_score_range
      check (quality_score is null or (quality_score between 0 and 100));
  end if;
end $$;

-- hard_failures 기반 빠른 필터 (관리자 대시보드 "품질 실패 블로그" 목록).
create index if not exists idx_blog_posts_hard_failures
  on blog_posts using gin (hard_failures);

comment on column blog_posts.quality_rules_report is 'quality-v2 16룰 결과 전체 (RuleResult[])';
comment on column blog_posts.hard_failures is 'severity=fail & !pass 인 룰 id 배열 (writer rewrite 트리거)';

-- ============================================================
-- blog-thumbnails Storage 버킷 (Phase 3 사전 준비)
-- gpt-image-2 low 로 생성되는 블로그 썸네일 저장소.
-- 014_places_images_storage.sql 와 동일 패턴 — 공개 읽기, 서비스 롤 쓰기.
-- ============================================================
insert into storage.buckets (id, name, public)
values ('blog-thumbnails', 'blog-thumbnails', true)
on conflict (id) do nothing;

drop policy if exists "blog-thumbnails public read" on storage.objects;
create policy "blog-thumbnails public read"
  on storage.objects for select
  using (bucket_id = 'blog-thumbnails');

drop policy if exists "blog-thumbnails service write" on storage.objects;
create policy "blog-thumbnails service write"
  on storage.objects for insert
  with check (bucket_id = 'blog-thumbnails' and auth.role() = 'service_role');

drop policy if exists "blog-thumbnails service update" on storage.objects;
create policy "blog-thumbnails service update"
  on storage.objects for update
  using (bucket_id = 'blog-thumbnails' and auth.role() = 'service_role');

drop policy if exists "blog-thumbnails service delete" on storage.objects;
create policy "blog-thumbnails service delete"
  on storage.objects for delete
  using (bucket_id = 'blog-thumbnails' and auth.role() = 'service_role');
