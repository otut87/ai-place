-- 048 — 블로그 썸네일/이미지 파이프라인 제거.
--
-- 변경 내용:
--  1. blog_posts.thumbnail_url 컬럼 drop (T-195 gpt-image-2 생성 결과 저장소)
--  2. blog_posts.image_urls 컬럼 drop (인포그래픽/업체 사진 URL 리스트)
--
-- 배경:
--  - gpt-image 썸네일 품질이 블로그 품질 기여도에 비해 낮고 비용·장애 리스크 큼.
--  - AI 검색(ChatGPT/Claude) 은 이미지 비중 낮음 — 텍스트 품질 우선.
--  - Supabase Storage `blog-thumbnails/` 버킷은 콘솔에서 수동 삭제 필요 (SQL 로 bucket drop 은 위험).
--
-- 되돌릴 때: 이 마이그레이션 역순으로 컬럼 재추가 + pipeline.ts / image-generator 복구.

alter table blog_posts drop column if exists thumbnail_url;
alter table blog_posts drop column if exists image_urls;
