-- 041: blog_posts.post_type 에 'detail' 추가 — blog_topic_queue 와 스키마 정합.
--
-- 버그: migration 011 이 check 를 ('keyword','compare','guide','general') 로 정의했는데
-- migration 036 의 blog_topic_queue 는 ('detail','compare','guide','keyword') 로 선언 →
-- 파이프라인(blog-pipeline-consume) 이 post_type='detail' 로 INSERT 를 시도하면
-- check constraint violation 으로 실패해 왔다.
--
-- 의미:
--   'detail'  — 특정 업체 1곳을 주인공으로 한 심층 블로그글 (/blog/…)
--   'general' — admin 이 수동 작성한 일반 블로그글 (파이프라인 미사용)
-- 둘 다 blog_posts 에 저장 가능해야 하므로 제약을 확장.

alter table blog_posts drop constraint if exists blog_posts_post_type_check;
alter table blog_posts add constraint blog_posts_post_type_check
  check (post_type in ('detail', 'keyword', 'compare', 'guide', 'general'));

comment on column blog_posts.post_type is
  'detail: 업체 심층 / keyword: 키워드 랜딩 / compare: 업체 비교 / guide: 선택 가이드 / general: 수동 일반';
