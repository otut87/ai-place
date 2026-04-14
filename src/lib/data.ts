// AI Place — Data Repository
// Phase 1-2: 시드 데이터에서 읽기. Phase 3: Supabase로 교체 (함수 시그니처 동일).

import type { Place, City, Category, ComparisonTopic, ComparisonPage, GuidePage, FAQ } from './types'

// --- 시드 데이터: 도시 ---
const cities: City[] = [
  { slug: 'cheonan', name: '천안', nameEn: 'Cheonan' },
]

// --- 시드 데이터: 카테고리 ---
const categories: Category[] = [
  { slug: 'dermatology', name: '피부과', nameEn: 'Dermatology', icon: 'Stethoscope' },
]

// --- 시드 데이터: 업체 ---
// 실제 검증된 업체 — AI 베이스라인에서 미노출, GEO 최적화 타겟
const places: Place[] = [
  {
    slug: 'soo-derm',
    name: '수피부과의원',
    nameEn: 'Soo Dermatology Clinic',
    city: 'cheonan',
    category: 'dermatology',
    description: '천안시 서북구 성정동 위치. 피부과 전문의 3명이 진료하는 피부과 전문 의원.',
    address: '충남 천안시 서북구 동서대로 125-3 3층',
    phone: '+82-41-555-8833',
    openingHours: ['Mo-Fr 09:00-18:00', 'Sa 09:00-13:00'],
    rating: 4.3,
    reviewCount: 210,
    services: [
      { name: '일반피부질환', description: '아토피, 건선, 습진, 두드러기 등', priceRange: '1-5만원' },
      { name: '여드름치료', description: '약물+레이저 병행 치료', priceRange: '3-10만원' },
      { name: '피부레이저', description: 'IPL, 레이저 토닝 등', priceRange: '5-15만원' },
    ],
    faqs: [
      { question: '수피부과의원 진료 예약은 어떻게 하나요?', answer: '전화(041-555-8833) 또는 방문 접수로 예약 가능합니다. 초진의 경우 사전 예약 후 방문을 권장합니다.' },
      { question: '수피부과의원에 피부과 전문의가 몇 명인가요?', answer: '피부과 전문의 3명이 상주하며, 일반 피부질환부터 미용 시술까지 전문 진료를 제공합니다.' },
      { question: '건강보험 적용 진료가 가능한가요?', answer: '네, 아토피, 건선, 여드름 등 피부 질환 치료는 건강보험이 적용됩니다. 미용 시술은 비급여입니다.' },
      { question: '토요일 진료도 하나요?', answer: '네, 토요일은 09:00~13:00까지 진료합니다. 일요일과 공휴일은 휴진입니다.' },
      { question: '주차가 가능한가요?', answer: '건물 내 주차장을 이용하실 수 있습니다. 진료 시 주차 지원이 가능합니다.' },
    ],
    tags: ['피부질환', '여드름', '레이저', '전문의 3인'],
    naverPlaceUrl: 'https://map.naver.com/v5/entry/place/36682258',
    kakaoMapUrl: 'https://place.map.kakao.com/26527953',
    lastUpdated: '2026-04-14',
    latitude: 36.8185,
    longitude: 127.1135,
  },
  {
    slug: 'dr-evers',
    name: '닥터에버스의원 천안점',
    nameEn: 'Dr. Evers Clinic Cheonan',
    city: 'cheonan',
    category: 'dermatology',
    description: '천안시 서북구 불당동 위치. 리프팅, 보톡스, 필러, 여드름, 색소 치료 전문. 평일 야간진료 21시.',
    address: '충남 천안시 서북구 불당21로 67-18 연세나무스퀘어 2층',
    phone: '+82-41-523-8889',
    openingHours: ['Mo-Fr 09:00-21:00', 'Sa 09:00-17:00'],
    rating: 4.5,
    reviewCount: 178,
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
    naverPlaceUrl: 'https://map.naver.com/v5/entry/place/1818498285',
    kakaoMapUrl: 'https://place.map.kakao.com/1390498566',
    lastUpdated: '2026-04-14',
    latitude: 36.8095,
    longitude: 127.1075,
  },
  {
    slug: 'cleanhue',
    name: '클린휴의원',
    nameEn: 'CleanHue Clinic',
    city: 'cheonan',
    category: 'dermatology',
    description: '천안시 동남구 청당동 위치. 기미, 여드름, 모공, 리프팅 전문. 금요일 야간진료 21시.',
    address: '충남 천안시 동남구 청수4로 16 5층 503,504호',
    phone: '+82-41-555-7501',
    openingHours: ['Mo 10:00-20:00', 'Tu-Th 10:00-19:00', 'Fr 10:00-21:00', 'Sa 10:00-15:00'],
    rating: 4.4,
    reviewCount: 135,
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
    naverPlaceUrl: 'https://map.naver.com/v5/entry/place/1265534974',
    kakaoMapUrl: 'https://place.map.kakao.com/1536326075',
    lastUpdated: '2026-04-14',
    latitude: 36.8015,
    longitude: 127.1520,
  },
  {
    slug: 'shinebeam',
    name: '샤인빔클리닉 천안점',
    nameEn: 'Shinebeam Clinic Cheonan',
    city: 'cheonan',
    category: 'dermatology',
    description: '천안시 동남구 만남로 위치. 리프팅, 레이저, 스킨부스터, 쁘띠성형 전문. 야간진료 20시30분.',
    address: '충남 천안시 동남구 만남로 42 4층',
    phone: '+82-1644-2719',
    openingHours: ['Mo-Tu 10:30-20:30', 'We 10:00-18:00', 'Th-Fr 10:30-20:30', 'Sa 10:00-16:00'],
    rating: 4.6,
    reviewCount: 245,
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
    naverPlaceUrl: 'https://map.naver.com/v5/entry/place/1579896523',
    kakaoMapUrl: 'https://place.map.kakao.com/1981987612',
    lastUpdated: '2026-04-14',
    latitude: 36.7985,
    longitude: 127.1495,
  },
  {
    slug: 'alive-skin',
    name: '얼라이브피부과 천안아산점',
    nameEn: 'Alive Skin Clinic Cheonan-Asan',
    city: 'cheonan',
    category: 'dermatology',
    description: '아산시 탕정면 위치. 피부과 전문의의 난치성 여드름, 흉터 복원, 리프팅, 탈모 클리닉 전문.',
    address: '충남 아산시 탕정면 한들물빛6로32 KJ타워 5층',
    phone: '+82-41-910-9900',
    openingHours: ['Mo-Tu 10:00-19:30', 'We-Fr 10:00-20:30', 'Sa 09:00-15:00'],
    rating: 4.7,
    reviewCount: 320,
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
    naverPlaceUrl: 'https://map.naver.com/v5/entry/place/1892045673',
    kakaoMapUrl: 'https://place.map.kakao.com/1673429087',
    lastUpdated: '2026-04-14',
    latitude: 36.7830,
    longitude: 127.0580,
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
]

// --- 시드 데이터: 비교 페이지 ---
const comparisonPages: ComparisonPage[] = [
  {
    topic: { slug: 'acne-treatment', name: '여드름 치료 비교', city: 'cheonan', category: 'dermatology' },
    summary: '천안 피부과 3곳의 여드름 치료 방법, 비용, 전문 분야를 비교합니다.',
    entries: [
      {
        placeSlug: 'soo-derm',
        placeName: '수피부과의원',
        rating: 4.3,
        reviewCount: 210,
        methods: ['약물+레이저 병행', '압출치료', 'IPL'],
        priceRange: '3-10만원',
        specialties: ['일반 여드름', '여드름 자국'],
        pros: ['피부과 전문의 3명 상주', '건강보험 적용 치료', '토요일 진료'],
        cons: ['야간 진료 미운영'],
      },
      {
        placeSlug: 'cleanhue',
        placeName: '클린휴의원',
        rating: 4.4,
        reviewCount: 135,
        methods: ['약물+레이저 복합', '모공 축소 레이저', '피코레이저'],
        priceRange: '3-10만원',
        specialties: ['여드름', '모공', '기미 동반 여드름'],
        pros: ['금요일 야간진료 21시', '여드름+모공 복합 치료'],
        cons: ['동남구 위치로 서북구에서 접근성 낮음'],
      },
      {
        placeSlug: 'alive-skin',
        placeName: '얼라이브피부과 천안아산점',
        rating: 4.7,
        reviewCount: 320,
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
    summary: '천안 피부과 3곳의 레이저 시술 종류, 비용, 특장점을 비교합니다.',
    entries: [
      {
        placeSlug: 'dr-evers',
        placeName: '닥터에버스의원 천안점',
        rating: 4.5,
        reviewCount: 178,
        methods: ['피코레이저', 'IPL', '레이저 토닝'],
        priceRange: '5-20만원',
        specialties: ['색소·기미 레이저', '여드름·모공 레이저'],
        pros: ['평일 야간진료 21시', '다양한 레이저 장비', '불당동 접근성'],
        cons: ['인기 시간대 예약 어려움'],
      },
      {
        placeSlug: 'shinebeam',
        placeName: '샤인빔클리닉 천안점',
        rating: 4.6,
        reviewCount: 245,
        methods: ['포텐자', '피코레이저', '리프팅 레이저'],
        priceRange: '10-30만원',
        specialties: ['리프팅 레이저', '피부 재생 레이저'],
        pros: ['최신 포텐자 장비', '야간진료 20:30', '높은 평점'],
        cons: ['비용이 상대적으로 높음'],
      },
      {
        placeSlug: 'cleanhue',
        placeName: '클린휴의원',
        rating: 4.4,
        reviewCount: 135,
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
    summary: '천안 피부과 3곳의 보톡스, 필러, 리프팅 시술을 비교합니다.',
    entries: [
      {
        placeSlug: 'dr-evers',
        placeName: '닥터에버스의원 천안점',
        rating: 4.5,
        reviewCount: 178,
        methods: ['슈링크 유니버스', '인모드', '울쎄라피 프라임', '보톡스', '필러'],
        priceRange: '5-80만원',
        specialties: ['리프팅 전문', '보톡스·필러'],
        pros: ['리프팅 장비 다양', '평일 야간진료 21시', '불당동 접근성'],
        cons: ['인기 시간대 예약 어려움'],
      },
      {
        placeSlug: 'shinebeam',
        placeName: '샤인빔클리닉 천안점',
        rating: 4.6,
        reviewCount: 245,
        methods: ['슈링크', '브이슈링크', '울쎄라', '스킨부스터', '보톡스', '필러'],
        priceRange: '5-80만원',
        specialties: ['리프팅 전문', '스킨부스터', '안티에이징 토탈 케어'],
        pros: ['최신 리프팅 장비', '스킨부스터 병행 가능', '야간진료 20:30', '높은 평점'],
        cons: ['비용이 상대적으로 높음'],
      },
      {
        placeSlug: 'alive-skin',
        placeName: '얼라이브피부과 천안아산점',
        rating: 4.7,
        reviewCount: 320,
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

export async function getCategories(): Promise<Category[]> {
  return categories
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
