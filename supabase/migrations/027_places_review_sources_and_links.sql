-- 027: places 테이블에 소스별 평점/리뷰수 + 외부 링크 3종 추가 (Phase 11)
-- 참고: medicalkoreaguide 벤치마크 — Naver/Kakao/Google 각 리뷰수와 Kakao 평점,
-- 그리고 홈페이지/블로그/Instagram 링크 슬롯.
--
-- 정책:
-- - google_rating / google_review_count : Google Places API 로 자동 수집 (공식 API).
-- - naver_review_count / kakao_rating / kakao_review_count : owner/admin 수동 입력.
--   (Kakao·Naver 는 평점/리뷰수 공식 API 미제공 → 스크래핑 금지, 수동만 허용)
-- - homepage_url / blog_url / instagram_url : owner/admin 수동 입력.
--
-- 기존 rating / review_count 컬럼은 "종합 대표 평점"으로 유지 (Google 오버라이드 + fallback).

alter table places add column if not exists google_rating numeric(2,1);
alter table places add column if not exists google_review_count integer;
alter table places add column if not exists naver_review_count integer;
alter table places add column if not exists kakao_rating numeric(2,1);
alter table places add column if not exists kakao_review_count integer;

alter table places add column if not exists homepage_url text;
alter table places add column if not exists blog_url text;
alter table places add column if not exists instagram_url text;

-- CHECK 제약 — 평점 0~5, 리뷰수 >= 0
alter table places drop constraint if exists places_google_rating_range;
alter table places add constraint places_google_rating_range
  check (google_rating is null or (google_rating >= 0 and google_rating <= 5));

alter table places drop constraint if exists places_kakao_rating_range;
alter table places add constraint places_kakao_rating_range
  check (kakao_rating is null or (kakao_rating >= 0 and kakao_rating <= 5));

alter table places drop constraint if exists places_google_review_count_nonneg;
alter table places add constraint places_google_review_count_nonneg
  check (google_review_count is null or google_review_count >= 0);

alter table places drop constraint if exists places_naver_review_count_nonneg;
alter table places add constraint places_naver_review_count_nonneg
  check (naver_review_count is null or naver_review_count >= 0);

alter table places drop constraint if exists places_kakao_review_count_nonneg;
alter table places add constraint places_kakao_review_count_nonneg
  check (kakao_review_count is null or kakao_review_count >= 0);
