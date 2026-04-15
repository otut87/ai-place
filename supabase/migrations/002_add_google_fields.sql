-- 002: places 테이블에 Google Places API 연동 필드 추가
-- Google Place ID, Business URL, 리뷰 요약, 이미지 메타데이터

-- Google Place ID (자동 보강용)
alter table places add column if not exists google_place_id text;
create index if not exists idx_places_google_place_id on places(google_place_id);

-- Google Business Profile URL (sameAs 용)
alter table places add column if not exists google_business_url text;

-- 리뷰 요약 (Google Places API에서 추출, JSONB)
alter table places add column if not exists review_summaries jsonb default null;

-- 이미지 메타데이터 (alt 구조화, JSONB)
alter table places add column if not exists images jsonb default null;
