-- 042: place_mentions.page_type 'detail' → 'place' 리네이밍.
--
-- 목적: blog_posts.post_type='detail' (업체 심층 블로그글) 과
-- place_mentions.page_type='detail' (업체 상세 페이지 URL) 이 같은 단어를
-- 다른 의미로 써서 혼란 유발. page_type 쪽을 'place' 로 바꿔 완전 분리한다.
--
-- 실행 순서:
--   1) check 제약에 'place' 허용 추가 (양쪽 다 허용하는 과도기)
--   2) 기존 'detail' 행을 'place' 로 UPDATE
--   3) check 제약에서 'detail' 제거

-- 1) 임시로 'detail'/'place' 둘 다 허용
alter table place_mentions drop constraint if exists place_mentions_page_type_check;
alter table place_mentions add constraint place_mentions_page_type_check
  check (page_type in ('detail', 'place', 'blog', 'compare', 'guide', 'keyword'));

-- 2) 기존 detail 행 → place 로 갱신
update place_mentions set page_type = 'place' where page_type = 'detail';

-- 3) 'detail' 제거 — 최종 5종
alter table place_mentions drop constraint if exists place_mentions_page_type_check;
alter table place_mentions add constraint place_mentions_page_type_check
  check (page_type in ('place', 'blog', 'compare', 'guide', 'keyword'));

comment on column place_mentions.page_type is
  'place: 업체 상세 URL(/[city]/[category]/[slug]) / blog: 블로그글(/blog/...) / compare|guide|keyword: seed 소스 매핑';
