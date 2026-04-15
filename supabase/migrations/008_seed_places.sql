-- 008: 검증된 업체 시드 데이터 (data.ts와 동일)
-- 천안 피부과 5곳 — googlePlaceId, sameAs, FAQ 완전

INSERT INTO places (slug, name, name_en, city, category, google_place_id, description, address, phone, opening_hours, rating, review_count, services, faqs, tags, naver_place_url, kakao_map_url, latitude, longitude, status) VALUES
(
  'soo-derm', '수피부과의원', 'Soo Dermatology Clinic', 'cheonan', 'dermatology',
  'ChIJSROzO8EpezURBYXik534ATY',
  '천안시 서북구 성정동 위치. 피부과 전문의 3명이 진료하는 피부과 전문 의원.',
  '충남 천안시 서북구 동서대로 125-3 3층', '+82-41-555-8833',
  ARRAY['Mo-Fr 09:00-18:00', 'Sa 09:00-13:00'],
  4.3, 210,
  '[{"name":"일반피부질환","description":"아토피, 건선, 습진, 두드러기 등","priceRange":"1-5만원"},{"name":"여드름치료","description":"약물+레이저 병행 치료","priceRange":"3-10만원"},{"name":"피부레이저","description":"IPL, 레이저 토닝 등","priceRange":"5-15만원"}]'::jsonb,
  '[{"question":"수피부과의원 진료 예약은 어떻게 하나요?","answer":"전화(041-555-8833) 또는 방문 접수로 예약 가능합니다."},{"question":"수피부과의원에 피부과 전문의가 몇 명인가요?","answer":"피부과 전문의 3명이 상주합니다."},{"question":"건강보험 적용 진료가 가능한가요?","answer":"네, 아토피, 건선, 여드름 등은 건강보험이 적용됩니다."},{"question":"토요일 진료도 하나요?","answer":"네, 토요일은 09:00~13:00까지 진료합니다."},{"question":"주차가 가능한가요?","answer":"건물 내 주차장을 이용하실 수 있습니다."}]'::jsonb,
  ARRAY['피부질환', '여드름', '레이저', '전문의 3인'],
  'https://naver.me/GHvTSMEj', 'https://place.map.kakao.com/24575984',
  36.8185, 127.1135, 'active'
),
(
  'dr-evers', '닥터에버스의원 천안점', 'Dr. Evers Clinic Cheonan', 'cheonan', 'dermatology',
  'ChIJKepIcuMnezURi1MVsAQJHno',
  '천안시 서북구 불당동 위치. 리프팅, 보톡스, 필러, 여드름, 색소 치료 전문.',
  '충남 천안시 서북구 불당21로 67-18 연세나무스퀘어 2층', '+82-41-523-8889',
  ARRAY['Mo-Fr 09:00-21:00', 'Sa 09:00-17:00'],
  4.5, 178,
  '[{"name":"리프팅","description":"슈링크 유니버스, 인모드, 울쎄라피 프라임","priceRange":"20-80만원"},{"name":"보톡스·필러","description":"이마, 눈가, 사각턱, 코, 팔자","priceRange":"5-30만원"},{"name":"여드름·모공","description":"피지 조절, 모공 축소 레이저","priceRange":"5-15만원"},{"name":"색소·기미","description":"피코레이저, IPL, 레이저 토닝","priceRange":"5-20만원"}]'::jsonb,
  '[{"question":"닥터에버스의원 천안점 야간진료 시간은?","answer":"평일(월-금) 09:00~21:00까지 운영합니다."},{"question":"슈링크 유니버스 리프팅 비용은 얼마인가요?","answer":"부위와 샷 수에 따라 20-60만원 범위입니다."},{"question":"닥터에버스의원 예약 방법은?","answer":"전화(041-523-8889) 또는 온라인 예약으로 가능합니다."},{"question":"시술 후 일상생활이 바로 가능한가요?","answer":"보톡스, 필러는 당일 가능합니다."},{"question":"주차가 가능한가요?","answer":"연세나무스퀘어 건물 주차장을 이용하실 수 있습니다."}]'::jsonb,
  ARRAY['리프팅', '보톡스', '필러', '야간진료', '여드름', '색소'],
  'https://naver.me/IxsqzMRw', 'https://place.map.kakao.com/1961592614',
  36.8095, 127.1075, 'active'
),
(
  'cleanhue', '클린휴의원', 'CleanHue Clinic', 'cheonan', 'dermatology',
  'ChIJj1uqrNrXejURMiD-9qINPK0',
  '천안시 동남구 청당동 위치. 기미, 여드름, 모공, 리프팅 전문. 금요일 야간진료.',
  '충남 천안시 동남구 청수4로 16 5층 503,504호', '+82-41-555-7501',
  ARRAY['Mo 10:00-20:00', 'Tu-Th 10:00-19:00', 'Fr 10:00-21:00', 'Sa 10:00-15:00'],
  4.4, 135,
  '[{"name":"기미·색소치료","description":"레이저 토닝, 피코레이저, IPL","priceRange":"5-20만원"},{"name":"여드름치료","description":"약물+레이저 복합 치료","priceRange":"3-10만원"},{"name":"모공치료","description":"모공 축소 레이저","priceRange":"5-15만원"},{"name":"리프팅","description":"레이저 리프팅, 실리프팅","priceRange":"20-60만원"}]'::jsonb,
  '[{"question":"클린휴의원 진료 예약 방법은?","answer":"전화(041-555-7501)로 예약 가능합니다."},{"question":"금요일 야간진료 시간은?","answer":"금요일은 10:00~21:00까지 야간 진료합니다."},{"question":"기미 치료는 몇 회 정도 받아야 하나요?","answer":"보통 5-10회 시술로 개선 효과를 볼 수 있습니다."},{"question":"토요일 진료도 하나요?","answer":"네, 토요일은 10:00~15:00까지 진료합니다."},{"question":"주차가 가능한가요?","answer":"건물 내 주차장을 이용하실 수 있습니다."}]'::jsonb,
  ARRAY['기미', '여드름', '모공', '리프팅', '야간진료'],
  'https://naver.me/Fmf5bNpd', 'https://place.map.kakao.com/507473444',
  36.8015, 127.1520, 'active'
),
(
  'shinebeam', '샤인빔클리닉 천안점', 'Shinebeam Clinic Cheonan', 'cheonan', 'dermatology',
  'ChIJJZTC8PgpezUReI5aiJOxdyw',
  '천안시 동남구 만남로 위치. 리프팅, 레이저, 스킨부스터, 쁘띠성형 전문.',
  '충남 천안시 동남구 만남로 42 4층', '+82-1644-2719',
  ARRAY['Mo-Tu 10:30-20:30', 'We 10:00-18:00', 'Th-Fr 10:30-20:30', 'Sa 10:00-16:00'],
  4.6, 245,
  '[{"name":"리프팅","description":"슈링크, 브이슈링크, 울쎄라","priceRange":"20-80만원"},{"name":"스킨부스터","description":"스킨바이브, 쥬베룩 등","priceRange":"10-30만원"},{"name":"보톡스·필러","description":"이마, 눈가, 사각턱, 코","priceRange":"5-30만원"},{"name":"레이저","description":"포텐자, 피코레이저 등","priceRange":"10-30만원"}]'::jsonb,
  '[{"question":"샤인빔클리닉 천안점 야간진료가 가능한가요?","answer":"월/화/목/금은 20시30분까지 야간 진료합니다."},{"question":"슈링크 리프팅 비용은 얼마인가요?","answer":"부위와 샷 수에 따라 20-60만원 범위입니다."},{"question":"샤인빔클리닉 예약 방법은?","answer":"전화(1644-2719) 또는 온라인 예약으로 가능합니다."},{"question":"스킨부스터란 무엇인가요?","answer":"히알루론산 등 피부 유효 성분을 직접 주입하여 보습, 탄력을 개선하는 시술입니다."},{"question":"주차가 가능한가요?","answer":"건물 내 주차장을 이용하실 수 있습니다."}]'::jsonb,
  ARRAY['리프팅', '스킨부스터', '보톡스', '필러', '야간진료'],
  'https://naver.me/5z5iXWR6', NULL,
  36.7985, 127.1495, 'active'
),
(
  'alive-skin', '얼라이브피부과 천안아산점', 'Alive Skin Clinic Cheonan-Asan', 'cheonan', 'dermatology',
  'ChIJa6wuM9_ZejURUwnOp1f3S3E',
  '아산시 탕정면 위치. 난치성 여드름, 흉터 복원, 리프팅, 탈모 클리닉 전문.',
  '충남 아산시 탕정면 한들물빛6로32 KJ타워 5층', '+82-41-910-9900',
  ARRAY['Mo-Tu 10:00-19:30', 'We-Fr 10:00-20:30', 'Sa 09:00-15:00'],
  4.7, 320,
  '[{"name":"난치성여드름","description":"복합 치료 프로그램","priceRange":"5-15만원"},{"name":"흉터복원","description":"여드름 흉터, 수술 흉터 전문 복원","priceRange":"10-30만원"},{"name":"리프팅","description":"써마지, 울쎄라, 소프웨이브","priceRange":"30-100만원"},{"name":"탈모클리닉","description":"두피 진단, 약물+메조테라피","priceRange":"10-30만원"}]'::jsonb,
  '[{"question":"얼라이브피부과 천안아산점 위치가 어디인가요?","answer":"아산시 탕정면 한들물빛6로32 KJ타워 5층에 위치합니다."},{"question":"난치성 여드름이란 무엇인가요?","answer":"일반 치료에 잘 반응하지 않는 중등도~중증 여드름입니다."},{"question":"얼라이브피부과 예약 방법은?","answer":"전화(041-910-9900)로 예약 가능합니다."},{"question":"수요일, 금요일 야간진료가 가능한가요?","answer":"네, 수/금요일은 20시30분까지 야간 진료합니다."},{"question":"흉터 복원 치료는 몇 회 받아야 하나요?","answer":"흉터 유형에 따라 3-10회 시술이 필요합니다."}]'::jsonb,
  ARRAY['난치성여드름', '흉터복원', '리프팅', '탈모', '피부과전문의'],
  'https://naver.me/GRo4t3cr', 'https://place.map.kakao.com/574020547',
  36.7830, 127.0580, 'active'
)
ON CONFLICT (city, category, slug) DO NOTHING;
