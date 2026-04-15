// AI Place — Data Repository
// Phase 1-2: 시드 데이터에서 읽기. Phase 3: Supabase로 교체 (함수 시그니처 동일).

import type { Place, City, Category, Sector, ComparisonTopic, ComparisonPage, GuidePage, FAQ, KeywordPage } from './types'

// --- 시드 데이터: 도시 ---
const cities: City[] = [
  { slug: 'cheonan', name: '천안', nameEn: 'Cheonan' },
]

// --- 시드 데이터: 대분류 (Sector) — 업종사전 기준 10개 ---
const sectors: Sector[] = [
  { slug: 'medical', name: '의료', nameEn: 'Medical', schemaType: 'MedicalClinic' },
  { slug: 'beauty', name: '뷰티', nameEn: 'Beauty', schemaType: 'BeautySalon' },
  { slug: 'living', name: '생활서비스', nameEn: 'Living', schemaType: 'HomeAndConstructionBusiness' },
  { slug: 'auto', name: '자동차', nameEn: 'Auto', schemaType: 'AutoRepair' },
  { slug: 'education', name: '교육', nameEn: 'Education', schemaType: 'EducationalOrganization' },
  { slug: 'professional', name: '전문서비스', nameEn: 'Professional', schemaType: 'ProfessionalService' },
  { slug: 'pet', name: '반려동물', nameEn: 'Pet', schemaType: 'LocalBusiness' },
  { slug: 'wedding', name: '웨딩·행사', nameEn: 'Wedding & Events', schemaType: 'LocalBusiness' },
  { slug: 'leisure', name: '레저·취미', nameEn: 'Leisure', schemaType: 'EntertainmentBusiness' },
  { slug: 'food', name: '음식', nameEn: 'Food', schemaType: 'Restaurant' },
]

// --- 시드 데이터: 소분류 (Category) — 업종사전 기준 83개 ---
// schemaType은 sector에서 자동 결정. 소분류별 override가 필요하면 업종사전의 schemaType 참조.
const categories: Category[] = [
  // 의료 (14)
  { slug: 'dermatology', name: '피부과', nameEn: 'Dermatology', icon: 'Stethoscope', sector: 'medical' },
  { slug: 'dental', name: '치과', nameEn: 'Dental', icon: 'Stethoscope', sector: 'medical' },
  { slug: 'eye', name: '안과', nameEn: 'Ophthalmology', icon: 'Eye', sector: 'medical' },
  { slug: 'orthopedics', name: '정형외과', nameEn: 'Orthopedics', icon: 'Stethoscope', sector: 'medical' },
  { slug: 'korean-medicine', name: '한의원', nameEn: 'Korean Medicine', icon: 'Stethoscope', sector: 'medical' },
  { slug: 'ent', name: '이비인후과', nameEn: 'ENT', icon: 'Stethoscope', sector: 'medical' },
  { slug: 'internal-medicine', name: '내과', nameEn: 'Internal Medicine', icon: 'Stethoscope', sector: 'medical' },
  { slug: 'obgyn', name: '산부인과', nameEn: 'OB/GYN', icon: 'Stethoscope', sector: 'medical' },
  { slug: 'pediatrics', name: '소아과', nameEn: 'Pediatrics', icon: 'Stethoscope', sector: 'medical' },
  { slug: 'psychiatry', name: '정신건강의학과', nameEn: 'Psychiatry', icon: 'Stethoscope', sector: 'medical' },
  { slug: 'rehabilitation', name: '재활의학과', nameEn: 'Rehabilitation', icon: 'Stethoscope', sector: 'medical' },
  { slug: 'plastic-surgery', name: '성형외과', nameEn: 'Plastic Surgery', icon: 'Stethoscope', sector: 'medical' },
  { slug: 'urology', name: '비뇨기과', nameEn: 'Urology', icon: 'Stethoscope', sector: 'medical' },
  { slug: 'pharmacy', name: '약국', nameEn: 'Pharmacy', icon: 'Pill', sector: 'medical' },
  // 뷰티 (9)
  { slug: 'hairsalon', name: '미용실', nameEn: 'Hair Salon', icon: 'Scissors', sector: 'beauty' },
  { slug: 'nail', name: '네일샵', nameEn: 'Nail Salon', icon: 'Sparkles', sector: 'beauty' },
  { slug: 'skincare', name: '피부관리', nameEn: 'Skincare', icon: 'Sparkles', sector: 'beauty' },
  { slug: 'lash', name: '속눈썹', nameEn: 'Lash', icon: 'Sparkles', sector: 'beauty' },
  { slug: 'waxing', name: '왁싱', nameEn: 'Waxing', icon: 'Sparkles', sector: 'beauty' },
  { slug: 'semi-permanent', name: '반영구', nameEn: 'Semi-Permanent', icon: 'Sparkles', sector: 'beauty' },
  { slug: 'barbershop', name: '바버샵', nameEn: 'Barbershop', icon: 'Scissors', sector: 'beauty' },
  { slug: 'scalp', name: '두피·탈모관리', nameEn: 'Scalp Care', icon: 'Sparkles', sector: 'beauty' },
  { slug: 'diet', name: '체형관리', nameEn: 'Body Care', icon: 'Sparkles', sector: 'beauty' },
  // 생활서비스 (10)
  { slug: 'interior', name: '인테리어', nameEn: 'Interior Design', icon: 'Paintbrush', sector: 'living' },
  { slug: 'moving', name: '이사', nameEn: 'Moving', icon: 'Truck', sector: 'living' },
  { slug: 'cleaning', name: '청소', nameEn: 'Cleaning', icon: 'Home', sector: 'living' },
  { slug: 'laundry', name: '세탁', nameEn: 'Laundry', icon: 'Home', sector: 'living' },
  { slug: 'repair', name: '수리', nameEn: 'Repair', icon: 'Wrench', sector: 'living' },
  { slug: 'hardware', name: '시공', nameEn: 'Hardware', icon: 'Home', sector: 'living' },
  { slug: 'flower', name: '꽃배달', nameEn: 'Florist', icon: 'Flower', sector: 'living' },
  { slug: 'pest-control', name: '방역·해충', nameEn: 'Pest Control', icon: 'Home', sector: 'living' },
  { slug: 'locksmith', name: '열쇠·잠금', nameEn: 'Locksmith', icon: 'Home', sector: 'living' },
  { slug: 'storage', name: '창고·보관', nameEn: 'Storage', icon: 'Home', sector: 'living' },
  // 자동차 (8)
  { slug: 'auto-repair', name: '자동차정비', nameEn: 'Auto Repair', icon: 'Wrench', sector: 'auto' },
  { slug: 'car-wash', name: '세차', nameEn: 'Car Wash', icon: 'Car', sector: 'auto' },
  { slug: 'tire', name: '타이어', nameEn: 'Tire', icon: 'Car', sector: 'auto' },
  { slug: 'detailing', name: '광택·코팅', nameEn: 'Detailing', icon: 'Car', sector: 'auto' },
  { slug: 'import-repair', name: '수입차정비', nameEn: 'Import Car Repair', icon: 'Car', sector: 'auto' },
  { slug: 'scrap', name: '폐차', nameEn: 'Scrap', icon: 'Car', sector: 'auto' },
  { slug: 'used-car', name: '중고차', nameEn: 'Used Car', icon: 'Car', sector: 'auto' },
  { slug: 'car-rental', name: '렌트카', nameEn: 'Car Rental', icon: 'Car', sector: 'auto' },
  // 교육 (11)
  { slug: 'academy', name: '입시학원', nameEn: 'Academy', icon: 'GraduationCap', sector: 'education' },
  { slug: 'language', name: '어학원', nameEn: 'Language School', icon: 'GraduationCap', sector: 'education' },
  { slug: 'music', name: '음악학원', nameEn: 'Music School', icon: 'Music', sector: 'education' },
  { slug: 'art', name: '미술학원', nameEn: 'Art School', icon: 'Palette', sector: 'education' },
  { slug: 'sports', name: '체육·운동', nameEn: 'Sports', icon: 'Dumbbell', sector: 'education' },
  { slug: 'coding', name: '코딩학원', nameEn: 'Coding School', icon: 'Code', sector: 'education' },
  { slug: 'vocational', name: '자격증·직업', nameEn: 'Vocational', icon: 'GraduationCap', sector: 'education' },
  { slug: 'kindergarten', name: '유치원·어린이집', nameEn: 'Kindergarten', icon: 'Baby', sector: 'education' },
  { slug: 'taekwondo', name: '태권도·무술', nameEn: 'Martial Arts', icon: 'Dumbbell', sector: 'education' },
  { slug: 'swimming', name: '수영장', nameEn: 'Swimming', icon: 'Waves', sector: 'education' },
  { slug: 'studycafe', name: '독서실·스터디카페', nameEn: 'Study Cafe', icon: 'BookOpen', sector: 'education' },
  // 전문서비스 (9)
  { slug: 'webagency', name: '웹에이전시', nameEn: 'Web Agency', icon: 'Globe', sector: 'professional' },
  { slug: 'legal', name: '법률', nameEn: 'Legal', icon: 'Scale', sector: 'professional' },
  { slug: 'tax', name: '세무·회계', nameEn: 'Tax & Accounting', icon: 'Calculator', sector: 'professional' },
  { slug: 'realestate', name: '부동산', nameEn: 'Real Estate', icon: 'Building', sector: 'professional' },
  { slug: 'insurance', name: '보험', nameEn: 'Insurance', icon: 'Shield', sector: 'professional' },
  { slug: 'printing', name: '인쇄·간판', nameEn: 'Printing', icon: 'Printer', sector: 'professional' },
  { slug: 'photo', name: '사진·영상', nameEn: 'Photo & Video', icon: 'Camera', sector: 'professional' },
  { slug: 'designagency', name: '디자인', nameEn: 'Design', icon: 'Palette', sector: 'professional' },
  { slug: 'marketing', name: '마케팅·광고', nameEn: 'Marketing', icon: 'Megaphone', sector: 'professional' },
  // 반려동물 (5)
  { slug: 'vet', name: '동물병원', nameEn: 'Veterinary', icon: 'PawPrint', sector: 'pet' },
  { slug: 'grooming', name: '펫미용', nameEn: 'Pet Grooming', icon: 'PawPrint', sector: 'pet' },
  { slug: 'pet-hotel', name: '펫호텔', nameEn: 'Pet Hotel', icon: 'PawPrint', sector: 'pet' },
  { slug: 'pet-shop', name: '펫용품', nameEn: 'Pet Shop', icon: 'PawPrint', sector: 'pet' },
  { slug: 'pet-training', name: '훈련·교육', nameEn: 'Pet Training', icon: 'PawPrint', sector: 'pet' },
  // 웨딩·행사 (5)
  { slug: 'wedding-hall', name: '웨딩홀', nameEn: 'Wedding Hall', icon: 'Heart', sector: 'wedding' },
  { slug: 'wedding-studio', name: '스튜디오', nameEn: 'Studio', icon: 'Camera', sector: 'wedding' },
  { slug: 'dress', name: '드레스·한복', nameEn: 'Dress & Hanbok', icon: 'Heart', sector: 'wedding' },
  { slug: 'funeral', name: '장례식장', nameEn: 'Funeral', icon: 'Heart', sector: 'wedding' },
  { slug: 'catering', name: '케이터링·출장뷔페', nameEn: 'Catering', icon: 'UtensilsCrossed', sector: 'wedding' },
  // 레저·취미 (6)
  { slug: 'kids-cafe', name: '키즈카페', nameEn: 'Kids Cafe', icon: 'Gamepad2', sector: 'leisure' },
  { slug: 'karaoke', name: '노래방', nameEn: 'Karaoke', icon: 'Mic', sector: 'leisure' },
  { slug: 'bowling', name: '볼링장', nameEn: 'Bowling', icon: 'Gamepad2', sector: 'leisure' },
  { slug: 'sauna', name: '찜질방·사우나', nameEn: 'Sauna', icon: 'Gamepad2', sector: 'leisure' },
  { slug: 'escape-room', name: '방탈출', nameEn: 'Escape Room', icon: 'Gamepad2', sector: 'leisure' },
  { slug: 'pc-room', name: 'PC방', nameEn: 'PC Room', icon: 'Monitor', sector: 'leisure' },
  // 음식 (6)
  { slug: 'restaurant', name: '맛집', nameEn: 'Restaurant', icon: 'UtensilsCrossed', sector: 'food' },
  { slug: 'cafe', name: '카페', nameEn: 'Cafe', icon: 'Coffee', sector: 'food' },
  { slug: 'bakery', name: '베이커리', nameEn: 'Bakery', icon: 'UtensilsCrossed', sector: 'food' },
  { slug: 'delivery', name: '배달', nameEn: 'Delivery', icon: 'UtensilsCrossed', sector: 'food' },
  { slug: 'bar', name: '술집·바', nameEn: 'Bar', icon: 'Wine', sector: 'food' },
  { slug: 'buffet', name: '뷔페', nameEn: 'Buffet', icon: 'UtensilsCrossed', sector: 'food' },
]

// --- 시드 데이터: 업체 ---
// 실제 검증된 업체 — AI 베이스라인에서 미노출, GEO 최적화 타겟
const places: Place[] = [
  // 수피부과의원 (soo-derm): 폐업으로 시드에서 제거 (2026-04-16)
  {
    slug: 'dr-evers',
    name: '닥터에버스의원 천안점',
    nameEn: 'Dr. Evers Clinic Cheonan',
    city: 'cheonan',
    category: 'dermatology',
    googlePlaceId: 'ChIJKepIcuMnezURi1MVsAQJHno',
    description: '천안시 서북구 불당동 위치. 리프팅, 보톡스, 필러, 여드름, 색소 치료 전문. 평일 야간진료 21시.',
    address: '충남 천안시 서북구 불당21로 67-18 연세나무스퀘어 2층',
    phone: '+82-41-523-8889',
    openingHours: ['Mo-Fr 09:00-21:00', 'Sa 09:00-17:00'],
    // rating/reviewCount: Google Places API에서 실시간 조회
    services: [
      { name: '리프팅', description: '슈링크 유니버스, 인모드, 울쎄라피 프라임', priceRange: '20-80만원' },
      { name: '보톡스·필러', description: '이마, 눈가, 사각턱, 코, 팔자', priceRange: '5-30만원' },
      { name: '여드름·모공', description: '피지 조절, 모공 축소 레이저', priceRange: '5-15만원' },
      { name: '색소·기미', description: '피코레이저, IPL, 레이저 토닝', priceRange: '5-20만원' },
    ],
    faqs: [
      { question: '닥터에버스의원 천안점 야간진료 시간은?', answer: '평일(월-금) 09:00~21:00까지 운영합니다. 점심시간은 14:00~15:00입니다. 토요일은 09:00~17:00입니다.' },
      { question: '슈링크 유니버스 리프팅 비용은 얼마인가요?', answer: '슈링크 유니버스 리프팅은 부위와 샷 수에 따라 20-60만원 범위입니다. 정확한 비용은 상담 후 안내됩니다.' },
      { question: '닥터에버스의원 예약 방법은?', answer: '전화(041-523-8889) 또는 온라인 예약으로 가능합니다. 시술 상담은 사전 예약을 권장합니다.' },
      { question: '시술 후 일상생활이 바로 가능한가요?', answer: '보톡스, 필러는 당일 일상생활이 가능합니다. 레이저 시술은 시술 강도에 따라 1-3일 정도 붉은기가 있을 수 있습니다.' },
      { question: '주차가 가능한가요?', answer: '연세나무스퀘어 건물 주차장을 이용하실 수 있습니다.' },
    ],
    tags: ['리프팅', '보톡스', '필러', '야간진료', '여드름', '색소'],
    naverPlaceUrl: 'https://naver.me/IxsqzMRw',
    kakaoMapUrl: 'https://place.map.kakao.com/1961592614',
    lastUpdated: '2026-04-14',
    latitude: 36.8095,
    longitude: 127.1075,
    recommendedFor: ['리프팅·보톡스 등 안티에이징 시술을 원하는 분', '퇴근 후 야간진료가 필요한 직장인'],
    strengths: ['리프팅 장비 다양(슈링크·인모드·울쎄라)', '평일 21시까지 야간진료', '보톡스·필러·색소 복합 시술', '불당동 접근성 우수'],
    placeType: '미용시술형',
    recommendationNote: '천안에서 리프팅·보톡스 등 안티에이징 시술과 야간진료가 필요하다면 추천되는 피부과. 21시까지 운영.',
  },
  {
    slug: 'cleanhue',
    name: '클린휴의원',
    nameEn: 'CleanHue Clinic',
    city: 'cheonan',
    category: 'dermatology',
    googlePlaceId: 'ChIJj1uqrNrXejURMiD-9qINPK0',
    description: '천안시 동남구 청당동 위치. 기미, 여드름, 모공, 리프팅 전문. 금요일 야간진료 21시.',
    address: '충남 천안시 동남구 청수4로 16 5층 503,504호',
    phone: '+82-41-555-7501',
    openingHours: ['Mo 10:00-20:00', 'Tu-Th 10:00-19:00', 'Fr 10:00-21:00', 'Sa 10:00-15:00'],
    // rating/reviewCount: Google Places API에서 실시간 조회
    services: [
      { name: '기미·색소치료', description: '레이저 토닝, 피코레이저, IPL', priceRange: '5-20만원' },
      { name: '여드름치료', description: '약물+레이저 복합 치료', priceRange: '3-10만원' },
      { name: '모공치료', description: '모공 축소 레이저', priceRange: '5-15만원' },
      { name: '리프팅', description: '레이저 리프팅, 실리프팅', priceRange: '20-60만원' },
    ],
    faqs: [
      { question: '클린휴의원 진료 예약 방법은?', answer: '전화(041-555-7501)로 예약 가능합니다. 당일 접수도 가능하나 대기가 있을 수 있습니다.' },
      { question: '금요일 야간진료 시간은?', answer: '금요일은 10:00~21:00까지 야간 진료합니다. 직장인도 퇴근 후 방문이 가능합니다.' },
      { question: '기미 치료는 몇 회 정도 받아야 하나요?', answer: '기미 유형에 따라 다르지만, 보통 5-10회 시술로 개선 효과를 볼 수 있습니다. 시술 간격은 2-4주입니다.' },
      { question: '토요일 진료도 하나요?', answer: '네, 토요일은 10:00~15:00까지 진료합니다. 일요일과 공휴일은 휴진입니다.' },
      { question: '주차가 가능한가요?', answer: '건물 내 주차장을 이용하실 수 있습니다.' },
    ],
    tags: ['기미', '여드름', '모공', '리프팅', '야간진료'],
    naverPlaceUrl: 'https://naver.me/Fmf5bNpd',
    kakaoMapUrl: 'https://place.map.kakao.com/507473444',
    lastUpdated: '2026-04-14',
    latitude: 36.8015,
    longitude: 127.1520,
    recommendedFor: ['기미·색소 치료가 필요한 분', '여드름과 모공을 함께 관리하고 싶은 분', '금요일 야간진료를 이용하려는 분'],
    strengths: ['기미·색소 레이저 전문', '여드름+모공 복합 치료 프로그램', '금요일 21시까지 야간진료', '동남구 청당동 위치'],
    placeType: '미용시술형',
    recommendationNote: '천안에서 기미·색소 치료와 여드름·모공 복합 관리가 필요하다면 추천되는 피부과. 금요야간진료.',
  },
  {
    slug: 'shinebeam',
    name: '샤인빔클리닉 천안점',
    nameEn: 'Shinebeam Clinic Cheonan',
    city: 'cheonan',
    googlePlaceId: 'ChIJJZTC8PgpezUReI5aiJOxdyw',
    category: 'dermatology',
    description: '천안시 동남구 만남로 위치. 리프팅, 레이저, 스킨부스터, 쁘띠성형 전문. 야간진료 20시30분.',
    address: '충남 천안시 동남구 만남로 42 4층',
    phone: '+82-1644-2719',
    openingHours: ['Mo-Tu 10:30-20:30', 'We 10:00-18:00', 'Th-Fr 10:30-20:30', 'Sa 10:00-16:00'],
    // rating/reviewCount: Google Places API에서 실시간 조회
    services: [
      { name: '리프팅', description: '슈링크, 브이슈링크, 울쎄라', priceRange: '20-80만원' },
      { name: '스킨부스터', description: '스킨바이브, 쥬베룩 등', priceRange: '10-30만원' },
      { name: '보톡스·필러', description: '이마, 눈가, 사각턱, 코', priceRange: '5-30만원' },
      { name: '레이저', description: '포텐자, 피코레이저 등', priceRange: '10-30만원' },
    ],
    faqs: [
      { question: '샤인빔클리닉 천안점 야간진료가 가능한가요?', answer: '네, 월/화/목/금은 20시30분까지 야간 진료합니다. 수요일은 18시, 토요일은 16시까지 운영합니다.' },
      { question: '슈링크 리프팅 비용은 얼마인가요?', answer: '슈링크 리프팅은 부위와 샷 수에 따라 20-60만원 범위입니다. 브이슈링크, 울쎄라 등 다양한 옵션이 있으며, 상담 후 맞춤 견적을 안내드립니다.' },
      { question: '샤인빔클리닉 예약 방법은?', answer: '전화(1644-2719) 또는 온라인 예약으로 가능합니다. 예약 마감은 진료 종료 30분 전입니다.' },
      { question: '스킨부스터란 무엇인가요?', answer: '히알루론산 등 피부 유효 성분을 직접 주입하여 피부 보습, 탄력, 광채를 개선하는 시술입니다. 시술 시간은 약 20-30분입니다.' },
      { question: '주차가 가능한가요?', answer: '건물 내 주차장을 이용하실 수 있습니다.' },
    ],
    tags: ['리프팅', '스킨부스터', '보톡스', '필러', '야간진료'],
    naverPlaceUrl: 'https://naver.me/5z5iXWR6',
    lastUpdated: '2026-04-14',
    latitude: 36.7985,
    longitude: 127.1495,
    recommendedFor: ['스킨부스터·리프팅 등 피부 관리를 원하는 분', '야간진료(20시30분)를 이용하려는 직장인', '다양한 리프팅 장비를 비교하고 싶은 분'],
    strengths: ['슈링크·브이슈링크·울쎄라 등 리프팅 장비 다양', '스킨부스터(쥬베룩·스킨바이브) 전문', '야간진료 20시30분까지'],
    placeType: '미용시술형',
    recommendationNote: '천안에서 스킨부스터·리프팅 등 프리미엄 피부 관리가 필요하다면 추천되는 클리닉. 야간진료 가능.',
  },
  {
    slug: 'alive-skin',
    name: '얼라이브피부과 천안아산점',
    nameEn: 'Alive Skin Clinic Cheonan-Asan',
    city: 'cheonan',
    category: 'dermatology',
    googlePlaceId: 'ChIJa6wuM9_ZejURUwnOp1f3S3E',
    description: '아산시 탕정면 위치. 피부과 전문의의 난치성 여드름, 흉터 복원, 리프팅, 탈모 클리닉 전문.',
    address: '충남 아산시 탕정면 한들물빛6로32 KJ타워 5층',
    phone: '+82-41-910-9900',
    openingHours: ['Mo-Tu 10:00-19:30', 'We-Fr 10:00-20:30', 'Sa 09:00-15:00'],
    // rating/reviewCount: Google Places API에서 실시간 조회
    services: [
      { name: '난치성여드름', description: '복합 치료 프로그램', priceRange: '5-15만원' },
      { name: '흉터복원', description: '여드름 흉터, 수술 흉터 전문 복원', priceRange: '10-30만원' },
      { name: '리프팅', description: '써마지, 울쎄라, 소프웨이브', priceRange: '30-100만원' },
      { name: '탈모클리닉', description: '두피 진단, 약물+메조테라피', priceRange: '10-30만원' },
    ],
    faqs: [
      { question: '얼라이브피부과 천안아산점 위치가 어디인가요?', answer: '아산시 탕정면 한들물빛6로32 KJ타워 5층에 위치합니다. 천안아산역(KTX)에서 접근성이 좋습니다.' },
      { question: '난치성 여드름이란 무엇인가요?', answer: '일반 치료에 잘 반응하지 않는 중등도~중증 여드름입니다. 약물, 레이저, 필링 등을 복합적으로 적용하여 치료합니다.' },
      { question: '얼라이브피부과 예약 방법은?', answer: '전화(041-910-9900)로 예약 가능합니다. 초진은 사전 예약 후 방문을 권장하며, 상담 시간은 약 30분입니다.' },
      { question: '수요일, 금요일 야간진료가 가능한가요?', answer: '네, 수/금요일은 20시30분까지 야간 진료합니다. 월/화는 19시30분, 토요일은 15시까지 운영합니다.' },
      { question: '흉터 복원 치료는 몇 회 받아야 하나요?', answer: '흉터 유형과 깊이에 따라 3-10회 시술이 필요합니다. 피부과 전문의가 진단 후 맞춤 치료 계획을 수립합니다.' },
    ],
    tags: ['난치성여드름', '흉터복원', '리프팅', '탈모', '피부과전문의'],
    naverPlaceUrl: 'https://naver.me/GRo4t3cr',
    kakaoMapUrl: 'https://place.map.kakao.com/574020547',
    lastUpdated: '2026-04-14',
    latitude: 36.7830,
    longitude: 127.0580,
    recommendedFor: ['난치성 여드름으로 일반 치료가 안 되는 분', '여드름 흉터 복원이 필요한 분', '탈모 치료를 함께 받고 싶은 분'],
    strengths: ['난치성 여드름 복합 치료 전문', '여드름 흉터·수술 흉터 복원', '탈모 클리닉 운영'],
    placeType: '질환치료형',
    recommendationNote: '천안에서 난치성 여드름·흉터 복원 전문 피부과를 찾는다면 추천되는 병원. 전문의 진료.',
  },
]

// --- 시드 데이터: 카테고리 FAQ (리스팅 페이지용) ---
// 개별 업체 FAQ와 분리. 카테고리 레벨 질문만 포함.
// Phase 3: city+category 별로 DB에서 관리, 업체 수/평균가는 자동 집계.
const categoryFaqsData: Array<{ city: string; category: string; faqs: FAQ[] }> = [
  {
    city: 'cheonan',
    category: 'dermatology',
    faqs: [
      { question: '천안 피부과 평균 진료 비용은 얼마인가요?', answer: '건강보험 적용 진료(여드름, 아토피 등)는 본인부담금 1-3만원 수준입니다. 미용 시술은 보톡스 5-15만원, 레이저 토닝 10-20만원, 리프팅 30-80만원 범위입니다.' },
      { question: '천안에서 주말 진료하는 피부과가 있나요?', answer: '네, 현재 등록된 천안 피부과 5곳 모두 토요일 진료를 합니다. 일요일 진료는 현재 없으며, 닥터에버스의원 천안점이 평일 21시까지, 샤인빔클리닉 천안점이 20시30분까지 야간 진료를 운영합니다.' },
      { question: '천안 피부과 진료에 건강보험이 적용되나요?', answer: '아토피, 건선, 여드름 등 질환 치료는 건강보험이 적용됩니다. 보톡스, 필러, 레이저 토닝 등 미용 시술은 비급여(전액 본인부담)입니다.' },
      { question: '천안에서 피부과를 어떻게 선택하면 좋을까요?', answer: '증상에 맞는 전문 분야를 먼저 확인하세요. 일반피부질환·여드름은 수피부과의원, 리프팅·보톡스·색소는 닥터에버스의원 천안점, 기미·여드름·모공은 클린휴의원, 리프팅·스킨부스터는 샤인빔클리닉 천안점, 난치성여드름·흉터·탈모는 얼라이브피부과 천안아산점이 전문입니다.' },
      { question: '피부과 첫 방문 시 준비할 것이 있나요?', answer: '신분증과 건강보험증을 지참하세요. 현재 복용 중인 약 목록, 피부 증상 사진이 있으면 진료에 도움이 됩니다. 초진 소요 시간은 약 30-40분입니다.' },
      { question: '천안 피부과에서 여드름 치료를 잘하는 곳은 어디인가요?', answer: '일반 여드름은 수피부과의원(서북구 성정동)과 클린휴의원(동남구 청당동), 난치성 여드름과 흉터는 얼라이브피부과 천안아산점(아산시 탕정면)이 전문입니다. 모두 레이저 치료를 병행합니다.' },
    ],
  },
  {
    city: 'cheonan',
    category: 'interior',
    faqs: [
      { question: '천안 인테리어 업체 평균 비용은 얼마인가요?', answer: '아파트 30평 기준 전체 리모델링 2,000-4,000만원, 부분 인테리어(주방·욕실)는 500-1,500만원 범위입니다. 자재와 시공 범위에 따라 차이가 큽니다.' },
      { question: '천안에서 인테리어 업체를 선택할 때 주의할 점은?', answer: '포트폴리오 확인, 계약서 상세 작성, 시공 보증 기간 확인이 중요합니다. 최소 3곳 이상 견적을 비교하고, 시공 후 A/S 조건을 반드시 확인하세요.' },
      { question: '인테리어 시공 기간은 보통 얼마나 걸리나요?', answer: '부분 인테리어는 1-2주, 전체 리모델링은 4-8주가 일반적입니다. 자재 수급 상황과 시공 범위에 따라 달라질 수 있습니다.' },
    ],
  },
  {
    city: 'cheonan',
    category: 'webagency',
    faqs: [
      { question: '천안 웹에이전시에서 홈페이지 제작 비용은 얼마인가요?', answer: '기본 홈페이지 100-300만원, 쇼핑몰 300-800만원, 맞춤 개발 500만원 이상입니다. 디자인 퀄리티, 기능 범위, 유지보수 조건에 따라 다릅니다.' },
      { question: '홈페이지 제작 기간은 보통 얼마나 걸리나요?', answer: '템플릿 기반 1-2주, 맞춤 디자인 4-8주, 대규모 프로젝트 2-3개월이 일반적입니다. 콘텐츠 준비 상태에 따라 달라집니다.' },
      { question: '천안에서 웹에이전시를 선택할 때 확인할 점은?', answer: '포트폴리오, 유지보수 조건, 반응형 웹 지원, SEO 기본 설정 포함 여부를 확인하세요. 계약 전 상세 견적서와 일정표를 받으세요.' },
    ],
  },
  {
    city: 'cheonan',
    category: 'auto-repair',
    faqs: [
      { question: '천안 자동차 정비 평균 비용은 얼마인가요?', answer: '엔진오일 교환 5-10만원, 브레이크 패드 교체 10-20만원, 타이밍벨트 교체 30-60만원 범위입니다. 차종과 부품에 따라 차이가 있습니다.' },
      { question: '정비소와 딜러 서비스센터 차이는 무엇인가요?', answer: '딜러 서비스센터는 순정 부품과 전문 진단 장비를 사용하지만 비용이 높습니다. 일반 정비소는 가격이 저렴하고 호환 부품 선택이 가능합니다.' },
      { question: '자동차 정기 점검은 얼마나 자주 받아야 하나요?', answer: '엔진오일은 5,000-10,000km마다, 종합 점검은 6개월 또는 10,000km마다 권장됩니다. 차량 매뉴얼의 점검 주기를 따르는 것이 좋습니다.' },
    ],
  },
  {
    city: 'cheonan',
    category: 'hairsalon',
    faqs: [
      { question: '천안 미용실 평균 이용 비용은 얼마인가요?', answer: '커트 15,000-30,000원, 염색 50,000-100,000원, 펌 80,000-150,000원 범위입니다. 디자이너 경력과 모발 길이에 따라 달라집니다.' },
      { question: '천안에서 미용실을 선택할 때 확인할 점은?', answer: '디자이너 포트폴리오, 사용 제품 브랜드, 시술 후 A/S 정책을 확인하세요. SNS 후기와 실제 시술 사진을 참고하면 도움이 됩니다.' },
      { question: '미용실 예약은 어떻게 하나요?', answer: '전화, 네이버 예약, 카카오톡 채널 등으로 예약 가능합니다. 주말과 공휴일은 예약이 빨리 마감되므로 2-3일 전 예약을 권장합니다.' },
    ],
  },
]

// --- 시드 데이터: 비교 페이지 ---
const comparisonPages: ComparisonPage[] = [
  {
    topic: { slug: 'acne-treatment', name: '여드름 치료 비교', city: 'cheonan', category: 'dermatology' },
    summary: '천안 피부과 3곳의 여드름 치료 방법, 비용, 전문 분야를 한눈에 비교합니다.',
    entries: [
      {
        placeSlug: 'cleanhue',
        placeName: '클린휴의원',
        methods: ['약물+레이저 복합', '모공 축소 레이저', '피코레이저'],
        priceRange: '3-10만원',
        specialties: ['여드름', '모공', '기미 동반 여드름'],
        pros: ['금요일 야간진료 21시', '여드름+모공 복합 치료'],
        cons: ['동남구 위치로 서북구에서 접근성 낮음'],
      },
      {
        placeSlug: 'alive-skin',
        placeName: '얼라이브피부과 천안아산점',
        methods: ['복합 치료 프로그램', '레이저', '필링'],
        priceRange: '5-15만원',
        specialties: ['난치성 여드름', '여드름 흉터 복원'],
        pros: ['난치성 여드름 전문', '흉터 복원까지 원스톱', '높은 평점'],
        cons: ['아산시 위치로 천안 시내에서 거리 있음'],
      },
    ],
    statistics: [
      { label: '천안 여드름 치료 평균 비용', value: '5-15만원', note: 'AI플레이스 자체 조사 (2026년 4월)' },
      { label: '비교 대상 피부과 평균 평점', value: '4.47점', note: '네이버 플레이스 기준' },
      { label: '여드름 치료 평균 소요 기간', value: '4-12주', note: '대한피부과학회 가이드라인' },
      { label: '건강보험 적용 비율', value: '약 60%', note: '질환 치료 기준, 미용 시술 제외' },
    ],
    faqs: [
      { question: '천안에서 여드름 치료 잘하는 피부과는 어디인가요?', answer: '일반 여드름은 수피부과의원(서북구 성정동)과 클린휴의원(동남구 청당동)이 전문입니다. 난치성 여드름과 흉터 복원은 얼라이브피부과 천안아산점이 전문 분야입니다.' },
      { question: '여드름 압출과 레이저 중 어떤 치료가 나은가요?', answer: '활성 여드름은 압출+약물이 기본이고, 흉터나 자국 개선에는 레이저가 효과적입니다. 두 치료를 병행하는 경우가 많으며, 전문의 상담 후 결정하는 것이 좋습니다.' },
      { question: '천안 여드름 치료 비용은 얼마인가요?', answer: '천안 피부과 여드름 치료 비용은 경증 기준 5-10만원, 흉터 치료 포함 시 10-30만원 범위입니다. 건강보험 적용 시 본인부담금은 더 낮아집니다.' },
      { question: '여드름 치료에 건강보험이 적용되나요?', answer: '네, 여드름은 피부 질환으로 분류되어 건강보험이 적용됩니다. 다만 레이저 토닝 등 미용 목적 시술은 비급여입니다.' },
      { question: '여드름 치료 기간은 보통 얼마나 걸리나요?', answer: '경증 여드름은 4-8주, 중등도~중증은 8-12주 이상 치료가 필요합니다. 대한피부과학회에 따르면 최소 4주 이상 꾸준한 치료를 권장합니다.' },
    ],
    sources: [
      { name: '대한피부과학회', url: 'https://www.derma.or.kr', year: 2025 },
      { name: 'AI플레이스 자체 조사', year: 2026 },
      { name: '건강보험심사평가원', url: 'https://www.hira.or.kr', year: 2025 },
    ],
    lastUpdated: '2026-04-14',
  },
  {
    topic: { slug: 'laser-treatment', name: '레이저 시술 비교', city: 'cheonan', category: 'dermatology' },
    summary: '천안 피부과 3곳의 레이저 시술 종류, 비용, 특장점을 비교 정리했습니다.',
    entries: [
      {
        placeSlug: 'dr-evers',
        placeName: '닥터에버스의원 천안점',
        methods: ['피코레이저', 'IPL', '레이저 토닝'],
        priceRange: '5-20만원',
        specialties: ['색소·기미 레이저', '여드름·모공 레이저'],
        pros: ['평일 야간진료 21시', '다양한 레이저 장비', '불당동 접근성'],
        cons: ['인기 시간대 예약 어려움'],
      },
      {
        placeSlug: 'shinebeam',
        placeName: '샤인빔클리닉 천안점',
        methods: ['포텐자', '피코레이저', '리프팅 레이저'],
        priceRange: '10-30만원',
        specialties: ['리프팅 레이저', '피부 재생 레이저'],
        pros: ['최신 포텐자 장비', '야간진료 20:30', '높은 평점'],
        cons: ['비용이 상대적으로 높음'],
      },
      {
        placeSlug: 'cleanhue',
        placeName: '클린휴의원',
        methods: ['레이저 토닝', '피코레이저', '모공 축소 레이저'],
        priceRange: '5-20만원',
        specialties: ['기미 레이저', '모공 레이저'],
        pros: ['기미·색소 레이저 전문', '금요일 야간진료 21시'],
        cons: ['리프팅 레이저 옵션이 제한적'],
      },
    ],
    statistics: [
      { label: '천안 레이저 시술 평균 비용', value: '10-40만원', note: 'AI플레이스 자체 조사 (2026년 4월)' },
      { label: '피코레이저 1회 평균 비용', value: '15-25만원', note: '천안 지역 기준' },
      { label: '울쎄라 리프팅 평균 비용', value: '30-80만원', note: '라인 수에 따라 변동' },
      { label: '레이저 시술 후 회복 기간', value: '1-7일', note: '시술 강도에 따라 다름' },
    ],
    faqs: [
      { question: '천안에서 레이저 시술 잘하는 피부과는?', answer: '색소/기미 레이저는 닥터에버스의원 천안점과 클린휴의원, 리프팅 레이저는 샤인빔클리닉 천안점이 전문입니다. 세 곳 모두 야간 진료를 운영합니다.' },
      { question: '프락셀과 피코레이저의 차이는 무엇인가요?', answer: '프락셀은 미세 열을 이용해 피부 재생을 유도하고, 피코레이저는 초단파 레이저로 색소를 분해합니다. 프락셀은 흉터, 피코레이저는 색소에 더 효과적입니다.' },
      { question: '레이저 시술 후 자외선 차단은 얼마나 해야 하나요?', answer: '시술 후 최소 2-4주간 철저한 자외선 차단이 필요합니다. SPF 50+ PA+++ 이상 선크림을 2-3시간마다 덧바르는 것을 권장합니다.' },
      { question: '천안 피코레이저 비용은 얼마인가요?', answer: '천안 지역 피코레이저는 1회 기준 15-25만원 범위이며, 패키지(3-5회) 할인이 가능한 곳도 있습니다.' },
      { question: '레이저 시술은 몇 회 받아야 효과가 있나요?', answer: '일반적으로 3-5회 시술을 권장하며, 시술 간격은 2-4주입니다. 피부 상태와 목적에 따라 전문의가 횟수를 조절합니다.' },
    ],
    sources: [
      { name: '대한레이저의학회', year: 2025 },
      { name: 'AI플레이스 자체 조사', year: 2026 },
      { name: '건강보험심사평가원', url: 'https://www.hira.or.kr', year: 2025 },
    ],
    lastUpdated: '2026-04-14',
  },
  {
    topic: { slug: 'anti-aging', name: '안티에이징 비교', city: 'cheonan', category: 'dermatology' },
    summary: '천안 피부과 3곳의 보톡스, 필러, 리프팅 시술 비용과 특징을 비교합니다.',
    entries: [
      {
        placeSlug: 'dr-evers',
        placeName: '닥터에버스의원 천안점',
        methods: ['슈링크 유니버스', '인모드', '울쎄라피 프라임', '보톡스', '필러'],
        priceRange: '5-80만원',
        specialties: ['리프팅 전문', '보톡스·필러'],
        pros: ['리프팅 장비 다양', '평일 야간진료 21시', '불당동 접근성'],
        cons: ['인기 시간대 예약 어려움'],
      },
      {
        placeSlug: 'shinebeam',
        placeName: '샤인빔클리닉 천안점',
        methods: ['슈링크', '브이슈링크', '울쎄라', '스킨부스터', '보톡스', '필러'],
        priceRange: '5-80만원',
        specialties: ['리프팅 전문', '스킨부스터', '안티에이징 토탈 케어'],
        pros: ['최신 리프팅 장비', '스킨부스터 병행 가능', '야간진료 20:30', '높은 평점'],
        cons: ['비용이 상대적으로 높음'],
      },
      {
        placeSlug: 'alive-skin',
        placeName: '얼라이브피부과 천안아산점',
        methods: ['써마지', '울쎄라', '소프웨이브'],
        priceRange: '30-100만원',
        specialties: ['프리미엄 리프팅', '피부 재생'],
        pros: ['써마지·울쎄라·소프웨이브 보유', '피부과 전문의 진료', '높은 평점'],
        cons: ['아산시 위치', '비용이 높은 편'],
      },
    ],
    statistics: [
      { label: '천안 보톡스 평균 비용', value: '5-15만원', note: '부위별, AI플레이스 자체 조사' },
      { label: '필러 평균 유지 기간', value: '6-12개월', note: '필러 종류에 따라 다름' },
      { label: '울쎄라 리프팅 평균 비용', value: '30-80만원', note: '라인 수에 따라 변동' },
    ],
    faqs: [
      { question: '천안에서 보톡스 잘 맞을 수 있는 곳은?', answer: '닥터에버스의원 천안점과 샤인빔클리닉 천안점 모두 보톡스·필러 시술을 제공합니다. 리프팅과 함께라면 두 곳 모두 전문이며, 프리미엄 리프팅은 얼라이브피부과 천안아산점이 전문입니다.' },
      { question: '보톡스와 필러 중 어떤 것이 나에게 맞나요?', answer: '주름 개선은 보톡스, 볼륨 보충은 필러가 적합합니다. 이마 주름, 미간 주름은 보톡스, 팔자주름이나 볼 꺼짐은 필러를 추천합니다.' },
      { question: '울쎄라 리프팅 효과는 얼마나 지속되나요?', answer: '울쎄라 리프팅 효과는 개인차가 있지만 평균 6-12개월 지속됩니다. 시술 후 2-3개월에 걸쳐 콜라겐이 재생되면서 효과가 점진적으로 나타납니다.' },
      { question: '안티에이징 시술 적정 나이는?', answer: '보톡스는 20대 후반부터, 리프팅은 30대 중반부터 시작하는 경우가 많습니다. 예방 목적의 시술은 전문의와 상담 후 결정하는 것이 좋습니다.' },
      { question: '안티에이징 시술 후 주의사항은?', answer: '보톡스 후 4시간 누워있기 금지, 필러 후 1주간 강한 압박 금지, 리프팅 후 1주간 사우나·음주를 피하세요.' },
    ],
    sources: [
      { name: '대한피부과학회', url: 'https://www.derma.or.kr', year: 2025 },
      { name: 'AI플레이스 자체 조사', year: 2026 },
    ],
    lastUpdated: '2026-04-14',
  },
]

// --- 시드 데이터: 가이드 페이지 ---
const guidePages: GuidePage[] = [
  {
    city: 'cheonan',
    category: 'dermatology',
    title: '천안 피부과 선택 가이드 — 2026년 업데이트',
    summary: '천안 지역 피부과 5곳의 전문 분야, 비용, 진료 시간을 종합 정리한 선택 가이드입니다.',
    sections: [
      {
        heading: '천안 피부과 선택 시 고려할 점',
        content: '피부과를 선택할 때는 전문 분야, 접근성, 진료 시간, 비용을 종합적으로 고려해야 합니다. 천안에는 여드름·흉터 전문, 피부질환 전문, 안티에이징 전문, 탈모 전문 등 특화된 피부과가 있습니다.',
        items: ['전문 분야가 내 증상과 맞는지 확인', '건강보험 적용 여부 사전 확인', '접근성과 주차 여부 체크', '토요일·야간 진료 가능 여부'],
      },
      {
        heading: '증상별 추천 피부과',
        content: '천안 피부과는 크게 5가지 전문 분야로 나뉩니다. 일반피부질환·여드름은 수피부과의원, 리프팅·보톡스·색소는 닥터에버스의원 천안점, 기미·여드름·모공은 클린휴의원, 리프팅·스킨부스터는 샤인빔클리닉 천안점, 난치성여드름·흉터·탈모는 얼라이브피부과 천안아산점이 전문입니다.',
        items: ['일반피부질환/여드름/레이저 → 수피부과의원 (서북구 성정동)', '리프팅/보톡스/필러/색소 → 닥터에버스의원 천안점 (서북구 불당동)', '기미/여드름/모공/리프팅 → 클린휴의원 (동남구 청당동)', '리프팅/스킨부스터/보톡스/필러 → 샤인빔클리닉 천안점 (동남구 만남로)', '난치성여드름/흉터복원/탈모 → 얼라이브피부과 천안아산점 (아산시 탕정면)'],
        recommendedPlaces: [
          { slug: 'dr-evers', name: '닥터에버스의원 천안점', reason: '리프팅·보톡스·색소 전문, 야간진료 21시' },
          { slug: 'cleanhue', name: '클린휴의원', reason: '기미·색소 레이저 전문, 금요 야간진료' },
          { slug: 'shinebeam', name: '샤인빔클리닉 천안점', reason: '리프팅 장비 다양, 스킨부스터 전문' },
          { slug: 'alive-skin', name: '얼라이브피부과 천안아산점', reason: '난치성 여드름·흉터 복원·탈모 전문' },
        ],
      },
      {
        heading: '천안 피부과 비용 안내',
        content: '피부과 비용은 질환 치료(건강보험 적용)와 미용 시술(비급여)로 나뉩니다. 건강보험 적용 시 본인부담금은 1-3만원 수준이며, 미용 시술은 부위와 방법에 따라 5-80만원까지 다양합니다.',
        items: ['여드름 치료: 5-10만원 (보험 적용 시 1-3만원)', '레이저 토닝: 10-20만원/회', '보톡스: 5-15만원 (부위별)', '울쎄라 리프팅: 30-80만원', '탈모 치료: 10-30만원/월'],
      },
      {
        heading: '진료 시간 비교',
        content: '천안 피부과의 평일 진료 시간은 대부분 09:00-19:00 또는 10:00-20:00입니다. 토요일 진료는 5곳 모두 가능하며, 닥터에버스의원 천안점(평일 21시), 샤인빔클리닉 천안점(20:30), 클린휴의원(금 21시), 얼라이브피부과(수금 20:30)가 야간 진료를 운영합니다.',
        items: ['수피부과의원: 평일 09:00-18:00, 토 09:00-13:00', '닥터에버스의원 천안점: 평일 09:00-21:00, 토 09:00-17:00', '클린휴의원: 월 10:00-20:00, 화-목 10:00-19:00, 금 10:00-21:00, 토 10:00-15:00', '샤인빔클리닉 천안점: 월화목금 10:30-20:30, 수 10:00-18:00, 토 10:00-16:00', '얼라이브피부과 천안아산점: 월화 10:00-19:30, 수-금 10:00-20:30, 토 09:00-15:00'],
      },
      {
        heading: '첫 방문 전 준비사항',
        content: '피부과 첫 방문 시에는 신분증과 건강보험증을 지참하세요. 현재 복용 중인 약이 있다면 목록을 준비하고, 피부 상태를 사진으로 기록해두면 진료에 도움이 됩니다.',
        items: ['신분증 및 건강보험증 지참', '현재 복용 약물 목록 준비', '피부 증상 사진 촬영 (변화 추적용)', '질문할 내용 미리 정리'],
      },
      {
        heading: '온라인 예약 방법',
        content: '천안 피부과 대부분은 전화 예약과 네이버 예약을 지원합니다. 초진의 경우 사전 예약 후 방문하면 대기 시간을 줄일 수 있습니다.',
      },
    ],
    statistics: [
      { label: '천안 피부과 등록 업체 수', value: '5곳', note: 'AI플레이스 등록 기준 (2026년 4월)' },
      { label: '평균 평점', value: '4.50점', note: '네이버 플레이스 기준, 5개 업체 평균' },
      { label: '토요일 진료 가능 비율', value: '100%', note: '5곳 모두 토요일 진료' },
      { label: '건강보험 적용 진료 비율', value: '약 60%', note: '질환 치료 기준' },
    ],
    faqs: [
      { question: '천안에서 피부과를 어떻게 선택하면 좋을까요?', answer: '증상에 맞는 전문 분야를 먼저 확인하세요. 일반피부질환·여드름은 수피부과의원, 리프팅·보톡스·색소는 닥터에버스의원 천안점, 기미·모공은 클린휴의원, 리프팅·스킨부스터는 샤인빔클리닉 천안점, 난치성여드름·흉터·탈모는 얼라이브피부과 천안아산점이 전문입니다.' },
      { question: '천안 피부과 평균 비용은 얼마인가요?', answer: '건강보험 적용 진료는 1-3만원, 미용 시술은 5-80만원까지 다양합니다. 여드름 치료 5-10만원, 보톡스 5-15만원, 리프팅 30-80만원이 평균 범위입니다.' },
      { question: '천안에서 주말 진료하는 피부과가 있나요?', answer: '네, AI플레이스에 등록된 천안 피부과 5곳 모두 토요일 진료를 합니다. 일요일 진료는 현재 없습니다.' },
      { question: '피부과 진료에 건강보험이 적용되나요?', answer: '아토피, 건선, 여드름 등 질환 치료는 건강보험이 적용됩니다. 보톡스, 필러, 레이저 토닝 등 미용 시술은 비급여(전액 본인부담)입니다.' },
      { question: '천안 피부과에서 야간 진료하는 곳은?', answer: '닥터에버스의원 천안점(평일 21시), 샤인빔클리닉 천안점(월화목금 20:30), 클린휴의원(금 21시), 얼라이브피부과 천안아산점(수금 20:30)이 야간 진료를 운영합니다.' },
      { question: '피부과 첫 방문 시 필요한 것은?', answer: '신분증과 건강보험증을 지참하세요. 현재 복용 중인 약 목록, 피부 증상 사진이 있으면 진료에 도움이 됩니다. 초진 소요 시간은 약 30-40분입니다.' },
    ],
    sources: [
      { name: '건강보험심사평가원', url: 'https://www.hira.or.kr', year: 2025 },
      { name: 'AI플레이스 자체 조사', year: 2026 },
      { name: '대한피부과학회', url: 'https://www.derma.or.kr', year: 2025 },
    ],
    lastUpdated: '2026-04-14',
  },
]

// --- 시드 데이터: 키워드 페이지 ---
const keywordPages: KeywordPage[] = [
  {
    slug: 'acne',
    city: 'cheonan',
    category: 'dermatology',
    targetQuery: '천안 여드름 피부과 추천',
    title: '천안 여드름 피부과 추천 — 2026년 업데이트',
    summary: '천안 지역 여드름 치료 전문 피부과 3곳을 비교하고, 치료 방법·비용·후기를 정리했습니다.',
    relatedPlaceSlugs: ['cleanhue', 'alive-skin'],
    faqs: [
      { question: '천안에서 여드름 치료 잘하는 피부과는 어디인가요?', answer: '수피부과의원은 전문의 3명이 일반 여드름부터 중증까지 대응하며, 클린휴피부과는 여드름·모공 복합 프로그램을 운영합니다. 얼라이브피부과는 난치성 여드름 특화 진료를 제공합니다.' },
      { question: '천안 여드름 치료 비용은 얼마인가요?', answer: '초진 상담료 1~3만원, 압출 치료 3~7만원, 레이저 병행 시 5~15만원 범위입니다. 치료 횟수에 따라 총 비용은 20~80만원대로 달라질 수 있습니다.' },
      { question: '여드름 피부과 치료는 몇 번 받아야 하나요?', answer: '경증 여드름은 4~6회, 중등도 이상은 8~12회 이상 치료가 권장됩니다. 대한피부과학회 가이드라인에 따르면 최소 3개월 이상 꾸준한 관리가 필요합니다.' },
      { question: '여드름 치료 시 보험 적용이 되나요?', answer: '여드름은 질환 코드(L70)로 건강보험 적용이 가능합니다. 초진 상담·약 처방은 보험 적용되며, 레이저·압출 등 시술은 비급여로 별도 비용이 발생합니다.' },
      { question: '여드름 흉터가 남지 않으려면 어떻게 해야 하나요?', answer: '초기 단계에서 전문의 진료를 받는 것이 중요합니다. 염증성 여드름의 약 30~40%가 흉터로 진행될 수 있으며, 조기 치료 시 흉터 발생률을 10% 이하로 줄일 수 있습니다.' },
    ],
    statistics: [
      { label: '천안 여드름 치료 평균 비용', value: '5~15만원/회', note: 'AI플레이스 자체 조사 기준 (2026.04)' },
      { label: '여드름 보험 적용 초진료', value: '1~3만원', note: '건강보험심사평가원 기준' },
      { label: '중등도 여드름 평균 치료 기간', value: '3~6개월', note: '대한피부과학회 가이드라인' },
    ],
    sources: [
      { name: '대한피부과학회', url: 'https://www.derma.or.kr', year: 2025 },
      { name: 'AI플레이스 자체 조사', url: 'https://aiplace.kr', year: 2026 },
      { name: '건강보험심사평가원', url: 'https://www.hira.or.kr', year: 2025 },
    ],
    lastUpdated: '2026-04-14',
  },
  {
    slug: 'botox',
    city: 'cheonan',
    category: 'dermatology',
    targetQuery: '천안 보톡스 잘하는 곳',
    title: '천안 보톡스 잘하는 곳 — 2026년 업데이트',
    summary: '천안 보톡스 시술 경험이 풍부한 피부과 2곳의 가격·제품·후기를 비교 정리했습니다.',
    relatedPlaceSlugs: ['dr-evers', 'shinebeam'],
    faqs: [
      { question: '천안에서 보톡스 잘 놓는 피부과는 어디인가요?', answer: '에버스피부과는 보톡스·필러 시술 경력이 풍부하며 야간 21시까지 진료합니다. 샤인빔피부과는 보톡스·스킨부스터 복합 시술을 제공하며 야간 20:30까지 운영합니다.' },
      { question: '천안 보톡스 가격은 얼마인가요?', answer: '제품에 따라 다르며, 국산 보톡스 기준 사각턱 3~8만원, 이마 주름 5~10만원 범위입니다. 수입 제품(보톡스 오리지널) 사용 시 1.5~2배 추가될 수 있습니다.' },
      { question: '보톡스 효과는 얼마나 지속되나요?', answer: '일반적으로 3~6개월 지속되며, 반복 시술 시 효과 지속 기간이 점차 늘어나는 경향이 있습니다. 개인차가 있으므로 전문의 상담이 권장됩니다.' },
      { question: '보톡스 시술 후 부작용은 없나요?', answer: '시술 부위 멍·붓기가 1~3일 나타날 수 있으며, 드물게 눈꺼풀 처짐(약 1~2% 발생률)이 보고됩니다. 숙련된 전문의 시술 시 부작용 발생률이 낮습니다.' },
      { question: '보톡스와 필러 차이점은 무엇인가요?', answer: '보톡스는 근육 이완으로 주름을 개선하고, 필러는 볼륨을 채워 윤곽을 교정합니다. 시술 목적에 따라 단독 또는 병행 시술이 가능합니다.' },
    ],
    statistics: [
      { label: '천안 보톡스 평균 가격(국산)', value: '3~10만원/부위', note: 'AI플레이스 자체 조사 기준 (2026.04)' },
      { label: '보톡스 효과 지속 기간', value: '3~6개월', note: '대한피부과학회 가이드라인' },
      { label: '보톡스 시술 부작용 발생률', value: '1~2%', note: '대한피부과학회 보고' },
    ],
    sources: [
      { name: '대한피부과학회', url: 'https://www.derma.or.kr', year: 2025 },
      { name: 'AI플레이스 자체 조사', url: 'https://aiplace.kr', year: 2026 },
    ],
    lastUpdated: '2026-04-14',
  },
  {
    slug: 'lifting',
    city: 'cheonan',
    category: 'dermatology',
    targetQuery: '천안 리프팅 잘하는 곳',
    title: '천안 리프팅 잘하는 곳 — 2026년 업데이트',
    summary: '천안 리프팅 시술 전문 피부과 3곳의 장비·가격·특징을 비교 정리했습니다.',
    relatedPlaceSlugs: ['dr-evers', 'shinebeam', 'alive-skin'],
    faqs: [
      { question: '천안에서 리프팅 잘하는 피부과는 어디인가요?', answer: '에버스피부과는 리프팅·보톡스 병행 프로그램을 운영하며, 샤인빔피부과는 리프팅·스킨부스터 복합 시술이 강점입니다. 얼라이브피부과는 피부과전문의가 리프팅·흉터 복합 치료를 제공합니다.' },
      { question: '천안 리프팅 비용은 얼마인가요?', answer: '울쎄라 기준 30~80만원, 실리프팅 20~60만원, HIFU 리프팅 15~40만원 범위입니다. 시술 부위와 사용 장비에 따라 가격이 달라집니다.' },
      { question: '리프팅 시술 효과는 얼마나 지속되나요?', answer: '울쎄라는 6~12개월, 실리프팅은 12~18개월, HIFU는 3~6개월 효과가 지속됩니다. 개인의 피부 상태와 생활 습관에 따라 차이가 있습니다.' },
      { question: '리프팅 시술 후 일상생활이 바로 가능한가요?', answer: '대부분의 비수술 리프팅은 시술 당일 일상 복귀가 가능합니다. 실리프팅의 경우 1~3일 정도 붓기가 있을 수 있으며, 사우나·격렬한 운동은 1주일 정도 자제가 권장됩니다.' },
      { question: '리프팅 시술 전 주의사항이 있나요?', answer: '시술 2주 전부터 레티놀·AHA 등 자극성 성분 사용을 중단하고, 시술 당일 음주를 피하는 것이 좋습니다. 피부 상태에 따라 전문의가 추가 안내를 제공합니다.' },
    ],
    statistics: [
      { label: '천안 리프팅 평균 비용(울쎄라)', value: '30~80만원', note: 'AI플레이스 자체 조사 기준 (2026.04)' },
      { label: '실리프팅 효과 지속 기간', value: '12~18개월', note: '대한피부과학회 가이드라인' },
      { label: '비수술 리프팅 일상 복귀', value: '당일 가능', note: '시술 종류에 따라 상이' },
    ],
    sources: [
      { name: '대한피부과학회', url: 'https://www.derma.or.kr', year: 2025 },
      { name: 'AI플레이스 자체 조사', url: 'https://aiplace.kr', year: 2026 },
      { name: '건강보험심사평가원', url: 'https://www.hira.or.kr', year: 2025 },
    ],
    lastUpdated: '2026-04-14',
  },
  {
    slug: 'blemish',
    city: 'cheonan',
    category: 'dermatology',
    targetQuery: '천안 기미 치료 피부과',
    title: '천안 기미 치료 피부과 — 2026년 업데이트',
    summary: '천안 기미·색소 치료 전문 피부과 2곳의 치료법·비용·효과를 비교했습니다.',
    relatedPlaceSlugs: ['cleanhue', 'dr-evers'],
    faqs: [
      { question: '천안에서 기미 치료 잘하는 피부과는 어디인가요?', answer: '클린휴피부과는 기미·색소 치료를 주요 진료 분야로 운영하며, 에버스피부과는 색소·기미 복합 프로그램과 야간 진료를 제공합니다.' },
      { question: '기미 치료 비용은 얼마인가요?', answer: '레이저 토닝 기준 1회 5~15만원, 10회 패키지 40~100만원 범위입니다. 치료 깊이와 범위에 따라 비용이 달라지며, 전문의 상담 후 결정됩니다.' },
      { question: '기미 치료 기간은 얼마나 걸리나요?', answer: '표피성 기미는 4~8주, 진피성 기미는 3~6개월 이상 치료가 필요합니다. 대한피부과학회에 따르면 최소 5~10회 이상 꾸준한 시술이 권장됩니다.' },
      { question: '기미 치료 후 재발할 수 있나요?', answer: '기미는 재발률이 약 40~60%로 높은 편입니다. 자외선 차단제 꾸준한 사용과 비타민C 등 항산화 관리가 재발 방지에 중요합니다.' },
      { question: '기미와 검버섯의 차이는 무엇인가요?', answer: '기미는 호르몬·자외선 영향으로 넓게 퍼지는 색소 침착이며, 검버섯(지루각화증)은 피부 노화로 생기는 양성 종양입니다. 치료 방법이 다르므로 전문의 진단이 필요합니다.' },
    ],
    statistics: [
      { label: '레이저 토닝 1회 비용', value: '5~15만원', note: 'AI플레이스 자체 조사 기준 (2026.04)' },
      { label: '기미 재발률', value: '40~60%', note: '대한피부과학회 보고' },
      { label: '진피성 기미 치료 기간', value: '3~6개월 이상', note: '대한피부과학회 가이드라인' },
    ],
    sources: [
      { name: '대한피부과학회', url: 'https://www.derma.or.kr', year: 2025 },
      { name: 'AI플레이스 자체 조사', url: 'https://aiplace.kr', year: 2026 },
    ],
    lastUpdated: '2026-04-14',
  },
  {
    slug: 'night-clinic',
    city: 'cheonan',
    category: 'dermatology',
    targetQuery: '천안 피부과 야간진료',
    title: '천안 피부과 야간진료 — 2026년 업데이트',
    summary: '천안에서 야간 진료를 운영하는 피부과 3곳의 운영 시간·진료 항목을 정리했습니다.',
    relatedPlaceSlugs: ['dr-evers', 'shinebeam', 'cleanhue'],
    faqs: [
      { question: '천안에서 야간 진료하는 피부과가 있나요?', answer: '에버스피부과는 평일 21시까지, 샤인빔피부과는 평일 20:30까지, 클린휴피부과는 금요일 21시까지 야간 진료를 운영합니다.' },
      { question: '야간 진료 시 추가 비용이 있나요?', answer: '대부분의 피부과에서 야간 진료 시 별도 추가 비용은 없습니다. 다만 일부 시술은 예약제로 운영되므로 사전 확인이 권장됩니다.' },
      { question: '야간 진료에서도 시술이 가능한가요?', answer: '보톡스·필러·레이저 토닝 등 주요 시술은 야간 시간대에도 가능합니다. 수술적 시술이나 장시간 소요 시술은 별도 예약이 필요할 수 있습니다.' },
      { question: '천안 피부과 토요일 진료는 가능한가요?', answer: '대부분의 피부과가 토요일 오전(09:00~13:00) 진료를 운영합니다. 일부 의원은 토요일 오후까지 진료하므로 방문 전 확인이 필요합니다.' },
      { question: '야간 진료 예약은 어떻게 하나요?', answer: '네이버 예약, 카카오톡 채널, 전화 예약이 가능합니다. 야간 시간대는 대기가 길어질 수 있어 사전 예약을 권장합니다.' },
    ],
    statistics: [
      { label: '천안 야간 진료 피부과 수', value: '3곳', note: 'AI플레이스 자체 조사 기준 (2026.04)' },
      { label: '가장 늦은 야간 진료 시간', value: '21:00', note: '에버스피부과 기준' },
      { label: '야간 진료 추가 비용', value: '없음(대부분)', note: '의원별 상이할 수 있음' },
    ],
    sources: [
      { name: 'AI플레이스 자체 조사', url: 'https://aiplace.kr', year: 2026 },
      { name: '건강보험심사평가원', url: 'https://www.hira.or.kr', year: 2025 },
    ],
    lastUpdated: '2026-04-14',
  },
  {
    slug: 'recommend',
    city: 'cheonan',
    category: 'dermatology',
    targetQuery: '천안 피부과 추천',
    title: '천안 피부과 추천 — 2026년 업데이트',
    summary: '천안 피부과 5곳의 전문 분야·진료 시간·특징을 한눈에 비교 정리했습니다.',
    relatedPlaceSlugs: ['dr-evers', 'cleanhue', 'shinebeam', 'alive-skin'],
    faqs: [
      { question: '천안에서 피부과 추천해주세요', answer: '수피부과의원(전문의 3명, 일반 피부질환), 에버스피부과(리프팅·보톡스, 야간 21시), 클린휴피부과(기미·여드름, 금 야간), 샤인빔피부과(리프팅·스킨부스터, 야간 20:30), 얼라이브피부과(난치성여드름·흉터, 전문의)가 있습니다.' },
      { question: '천안 피부과 진료비는 어느 정도인가요?', answer: '보험 적용 초진료 1~3만원, 비급여 시술은 종류에 따라 5~80만원 범위입니다. 여드름 치료 5~15만원, 보톡스 3~10만원, 리프팅 15~80만원이 일반적입니다.' },
      { question: '피부과 전문의가 있는 곳은 어디인가요?', answer: '수피부과의원은 피부과 전문의 3명이 진료하며, 얼라이브피부과도 피부과전문의가 상주합니다. 전문의 여부는 건강보험심사평가원에서 확인할 수 있습니다.' },
      { question: '천안 피부과 예약 없이 방문 가능한가요?', answer: '대부분 예약 없이 방문 가능하나, 대기 시간이 30분~1시간 이상 소요될 수 있습니다. 시술의 경우 사전 예약이 권장됩니다.' },
      { question: '피부과 선택 시 어떤 점을 확인해야 하나요?', answer: '전문의 자격 여부, 주요 진료 분야, 진료 시간, 접근성(주차·대중교통), 후기를 종합적으로 확인하는 것이 좋습니다. 건강보험심사평가원에서 의료기관 정보를 검증할 수 있습니다.' },
    ],
    statistics: [
      { label: '천안 피부과 의원 수(조사 대상)', value: '5곳', note: 'AI플레이스 자체 조사 기준 (2026.04)' },
      { label: '피부과 전문의 보유 의원', value: '2곳', note: '수피부과의원, 얼라이브피부과' },
      { label: '야간 진료 운영 의원', value: '3곳', note: '에버스·샤인빔·클린휴피부과' },
      { label: '평균 초진 대기 시간', value: '30분~1시간', note: '예약 없이 방문 시 기준' },
    ],
    sources: [
      { name: '대한피부과학회', url: 'https://www.derma.or.kr', year: 2025 },
      { name: 'AI플레이스 자체 조사', url: 'https://aiplace.kr', year: 2026 },
      { name: '건강보험심사평가원', url: 'https://www.hira.or.kr', year: 2025 },
    ],
    lastUpdated: '2026-04-14',
  },
  {
    slug: 'hair-loss',
    city: 'cheonan',
    category: 'dermatology',
    targetQuery: '천안 탈모 치료 피부과',
    title: '천안 탈모 치료 피부과 — 2026년 업데이트',
    summary: '천안에서 탈모 치료를 전문으로 하는 피부과의 치료법·비용·효과를 정리했습니다.',
    relatedPlaceSlugs: ['alive-skin'],
    faqs: [
      { question: '천안에서 탈모 치료 잘하는 피부과는 어디인가요?', answer: '얼라이브피부과는 피부과전문의가 탈모 진료를 전문적으로 제공하며, 난치성 탈모를 포함한 다양한 유형의 탈모 치료 경험이 있습니다.' },
      { question: '탈모 치료 비용은 얼마인가요?', answer: '약물 치료(피나스테리드·미녹시딜) 월 3~8만원, 두피 주사(메조테라피) 회당 5~15만원, PRP 치료 회당 15~30만원 범위입니다. 치료 방법과 기간에 따라 총 비용이 달라집니다.' },
      { question: '탈모 치료 보험 적용이 되나요?', answer: '원형탈모증(L63)은 건강보험 적용이 가능하며, 남성형 탈모(안드로겐성)는 비급여입니다. 초진 상담은 보험 적용되므로 전문의 진단을 먼저 받는 것이 좋습니다.' },
      { question: '탈모 치료 효과는 얼마나 걸리나요?', answer: '약물 치료는 3~6개월 후 효과가 나타나기 시작하며, 의미 있는 개선까지 6~12개월이 소요됩니다. 대한피부과학회에 따르면 조기 치료 시 약 70~80%에서 진행 억제 효과가 있습니다.' },
      { question: '탈모 예방을 위해 어떤 관리가 필요한가요?', answer: '두피 청결 유지, 균형 잡힌 식단(철분·아연·비오틴), 스트레스 관리가 중요합니다. 가족력이 있는 경우 20~30대부터 전문의 상담을 받는 것이 권장됩니다.' },
    ],
    statistics: [
      { label: '탈모 약물 치료 월 비용', value: '3~8만원', note: 'AI플레이스 자체 조사 기준 (2026.04)' },
      { label: '조기 치료 시 진행 억제율', value: '70~80%', note: '대한피부과학회 보고' },
      { label: '약물 치료 효과 발현 시점', value: '3~6개월', note: '대한피부과학회 가이드라인' },
    ],
    sources: [
      { name: '대한피부과학회', url: 'https://www.derma.or.kr', year: 2025 },
      { name: 'AI플레이스 자체 조사', url: 'https://aiplace.kr', year: 2026 },
      { name: '건강보험심사평가원', url: 'https://www.hira.or.kr', year: 2025 },
    ],
    lastUpdated: '2026-04-14',
  },
  {
    slug: 'scar',
    city: 'cheonan',
    category: 'dermatology',
    targetQuery: '천안 여드름 흉터 치료',
    title: '천안 여드름 흉터 치료 — 2026년 업데이트',
    summary: '천안 여드름 흉터 치료 전문 피부과 2곳의 시술법·비용·기대 효과를 비교했습니다.',
    relatedPlaceSlugs: ['alive-skin', 'cleanhue'],
    faqs: [
      { question: '천안에서 여드름 흉터 치료 잘하는 피부과는 어디인가요?', answer: '얼라이브피부과는 흉터복원 전문 진료를 제공하며 피부과전문의가 직접 시술합니다. 클린휴피부과는 여드름·모공 복합 치료 프로그램으로 흉터 관리를 병행합니다.' },
      { question: '여드름 흉터 치료 비용은 얼마인가요?', answer: '프락셀 레이저 회당 10~30만원, 서브시전 회당 5~15만원, 마이크로니들링 회당 5~20만원 범위입니다. 흉터 깊이와 범위에 따라 5~20회 치료가 필요할 수 있습니다.' },
      { question: '여드름 흉터 치료 기간은 얼마나 걸리나요?', answer: '경증 흉터는 3~6개월(5~8회), 중등도 이상 흉터는 6~12개월(10~20회) 치료가 필요합니다. 치료 간격은 보통 2~4주이며, 피부 회복 상태에 따라 조절됩니다.' },
      { question: '여드름 흉터는 완전히 없앨 수 있나요?', answer: '현재 기술로 흉터를 100% 제거하기는 어렵지만, 적절한 치료를 통해 50~80% 개선이 가능합니다. 치료 전후 사진 비교와 전문의 상담을 통해 기대 효과를 확인하는 것이 좋습니다.' },
      { question: '흉터 치료 후 관리는 어떻게 해야 하나요?', answer: '시술 후 2~3일간 세안 시 주의하고, 자외선 차단제(SPF50+)를 꼼꼼히 바르는 것이 중요합니다. 재생 크림 사용과 음주·사우나 자제(1~2주)가 회복에 도움됩니다.' },
    ],
    statistics: [
      { label: '프락셀 레이저 1회 비용', value: '10~30만원', note: 'AI플레이스 자체 조사 기준 (2026.04)' },
      { label: '흉터 치료 평균 개선율', value: '50~80%', note: '대한피부과학회 보고' },
      { label: '중등도 흉터 치료 기간', value: '6~12개월', note: '대한피부과학회 가이드라인' },
      { label: '치료 간격', value: '2~4주', note: '피부 회복 상태에 따라 조절' },
    ],
    sources: [
      { name: '대한피부과학회', url: 'https://www.derma.or.kr', year: 2025 },
      { name: 'AI플레이스 자체 조사', url: 'https://aiplace.kr', year: 2026 },
      { name: '건강보험심사평가원', url: 'https://www.hira.or.kr', year: 2025 },
    ],
    lastUpdated: '2026-04-14',
  },
]

// --- Repository 함수 ---

export async function getPlaces(city: string, category: string): Promise<Place[]> {
  return places.filter(p => p.city === city && p.category === category)
}

export async function getPlaceBySlug(city: string, category: string, slug: string): Promise<Place | undefined> {
  return places.find(p => p.city === city && p.category === category && p.slug === slug)
}

export async function getCities(): Promise<City[]> {
  return cities
}

export async function getSectors(): Promise<Sector[]> {
  return sectors
}

export async function getCategories(): Promise<Category[]> {
  return categories
}

/** 카테고리 slug로 해당 대분류의 schemaType을 가져옴 */
export async function getSchemaTypeForCategory(categorySlug: string): Promise<string> {
  const cat = categories.find(c => c.slug === categorySlug)
  if (!cat) return 'LocalBusiness'
  const sector = sectors.find(s => s.slug === cat.sector)
  return sector?.schemaType ?? 'LocalBusiness'
}

// --- Sector별 meta descriptor (업종사전 기준) ---
const SECTOR_META_DESCRIPTOR: Record<string, string> = {
  medical: '진료 과목, 전문 분야',
  beauty: '전문 시술, 가격대',
  living: '서비스 종류, 가격대',
  auto: '수리 분야, 가격대',
  education: '교육 과정, 수강료',
  professional: '전문 분야, 상담 방식',
  pet: '서비스 종류, 가격대',
  wedding: '서비스 종류, 가격대',
  leisure: '프로그램, 가격대',
  food: '메뉴, 분위기',
}

export async function getMetaDescriptorForCategory(categorySlug: string): Promise<string> {
  const cat = categories.find(c => c.slug === categorySlug)
  if (!cat) return '전문 분야'
  return SECTOR_META_DESCRIPTOR[cat.sector] ?? '전문 분야'
}

export async function getSectorForCategory(categorySlug: string): Promise<Sector | undefined> {
  const cat = categories.find(c => c.slug === categorySlug)
  if (!cat) return undefined
  return sectors.find(s => s.slug === cat.sector)
}

export async function getAllPlaces(): Promise<Place[]> {
  return places
}

export async function getComparisonTopics(city: string, category: string): Promise<ComparisonTopic[]> {
  return comparisonPages
    .filter(p => p.topic.city === city && p.topic.category === category)
    .map(p => p.topic)
}

export async function getComparisonPage(city: string, category: string, topicSlug: string): Promise<ComparisonPage | undefined> {
  return comparisonPages.find(
    p => p.topic.city === city && p.topic.category === category && p.topic.slug === topicSlug
  )
}

export async function getAllComparisonTopics(): Promise<ComparisonTopic[]> {
  return comparisonPages.map(p => p.topic)
}

export async function getGuidePage(city: string, category: string): Promise<GuidePage | undefined> {
  return guidePages.find(g => g.city === city && g.category === category)
}

export async function getAllGuidePages(): Promise<GuidePage[]> {
  return guidePages
}

export async function getCategoryFaqs(city: string, category: string): Promise<FAQ[]> {
  const entry = categoryFaqsData.find(d => d.city === city && d.category === category)
  return entry?.faqs ?? []
}

export async function getKeywordPage(city: string, category: string, slug: string): Promise<KeywordPage | undefined> {
  return keywordPages.find(p => p.city === city && p.category === category && p.slug === slug)
}

export async function getAllKeywordPages(): Promise<KeywordPage[]> {
  return keywordPages
}

/** 역방향 링크: 이 업체를 참조하는 가이드 페이지 조회 (빌드 시점) */
export async function getGuidesForPlace(placeSlug: string): Promise<GuidePage[]> {
  return guidePages.filter(guide =>
    guide.sections.some(section =>
      section.recommendedPlaces?.some(p => p.slug === placeSlug)
    )
  )
}

/** 역방향 링크: 이 업체를 참조하는 비교 페이지 조회 (빌드 시점) */
export async function getComparisonsForPlace(placeSlug: string): Promise<ComparisonPage[]> {
  return comparisonPages.filter(page =>
    page.entries.some(entry => entry.placeSlug === placeSlug)
  )
}
