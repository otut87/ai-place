-- 012: places 테이블에 외부 소스 ID / 주소 구성요소 추가 (T-019)
-- 3-Source 병합(#46) 후 업체당 Kakao/Google/Naver 여러 외부 ID 를 유지.
-- Daum Postcode 가 반환하는 sigunguCode/zonecode 도 별도 저장.

alter table places add column if not exists kakao_place_id text;
alter table places add column if not exists naver_place_id text;
alter table places add column if not exists road_address text;
alter table places add column if not exists jibun_address text;
alter table places add column if not exists sigungu_code text;
alter table places add column if not exists zonecode text;

-- 외부 ID 로 빠른 중복 검증 (insert 전에 lookup)
create index if not exists idx_places_kakao_place_id on places(kakao_place_id) where kakao_place_id is not null;
create index if not exists idx_places_naver_place_id on places(naver_place_id) where naver_place_id is not null;
