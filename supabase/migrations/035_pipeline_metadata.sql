-- 035: 블로그 파이프라인 메타 (T-195 / Phase 3)
-- writer → reviewer → checker → rewrite → image → similarity-guard 단계별 로그·결과물 저장.

-- pipeline_log: 단계별 {stage, model, inputTokens, outputTokens, latencyMs, issues, retried}
alter table blog_posts add column if not exists pipeline_log jsonb;

-- similarity-guard Jaccard 점수 (0.00 ~ 1.00). 0.25 이상 = 경고, 0.35 이상 = 차단.
alter table blog_posts add column if not exists similarity_score numeric(3,2);

-- 메인 썸네일 URL (gpt-image-2 low 생성 → blog-thumbnails 버킷 저장).
alter table blog_posts add column if not exists thumbnail_url text;

-- 이미지 자산 전체 — { infographics: string[] (SVG data URIs), placePhotos: string[] }
alter table blog_posts add column if not exists image_urls jsonb;

-- similarity_score 범위 체크
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'blog_posts_similarity_score_range'
  ) then
    alter table blog_posts
      add constraint blog_posts_similarity_score_range
      check (similarity_score is null or (similarity_score >= 0 and similarity_score <= 1));
  end if;
end $$;

-- "최근 30일 게시물" 쿼리 (similarity-guard 용) 인덱스 — status=active + published_at DESC
create index if not exists idx_blog_posts_active_published
  on blog_posts (status, published_at desc nulls last)
  where status = 'active';

comment on column blog_posts.pipeline_log is 'writer/reviewer/checker/image 단계별 실행 로그 (stage,model,tokens,latency,issues)';
comment on column blog_posts.similarity_score is '최근 30일 발행물 대비 최대 Jaccard 유사도 (0~1)';
comment on column blog_posts.thumbnail_url is 'blog-thumbnails/ 버킷 절대 URL — gpt-image-2 low 생성 결과';
comment on column blog_posts.image_urls is '{infographics: SVG data URI[], placePhotos: Google Places URI[]}';
