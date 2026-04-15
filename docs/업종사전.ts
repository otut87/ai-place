// ============================================================
// AI플레이스 업종 분류 체계 — 마스터 사전
// 생성일: 2026-04-16
// 용도: 코더 에이전트에게 전달하여 카테고리 시스템 구현
// ============================================================

// --- 타입 정의 ---

export interface SubCategory {
  slug: string;
  nameKo: string;
  keywords: string[];           // AI 검색에서 이 소분류를 찾는 검색어들
  schemaType?: string;          // 대분류 상속 시 생략, override 필요 시 명시
  metaDescriptor: string;       // meta description에 들어갈 업종 설명어
  priority: "high" | "medium" | "low"; // 확장 우선순위
}

export interface Category {
  slug: string;
  nameKo: string;
  nameEn: string;
  icon: string;                 // 대분류 아이콘 (lucide-react 기준)
  schemaType: string;           // 기본 Schema.org 타입
  metaTemplate: string;         // 카테고리 리스팅 meta description 템플릿
  hubTitle: string;             // 대분류 허브 페이지 H1 템플릿
  subcategories: SubCategory[];
}

// --- 템플릿 변수 설명 ---
// {city}    = 도시명 (천안)
// {sub}     = 소분류 한글명 (피부과)
// {count}   = 등록 업체 수
// {year}    = 현재 연도
// {month}   = 현재 월

// --- 마스터 사전 ---

export const CATEGORIES: Category[] = [

  // ========== 1. 의료 ==========
  {
    slug: "medical",
    nameKo: "의료",
    nameEn: "Medical",
    icon: "Stethoscope",
    schemaType: "MedicalClinic",
    metaTemplate: "{city}시에 위치한 {sub} {count}곳. 진료 과목, 전문 분야, 위치, 리뷰 기반 정리.",
    hubTitle: "{city} 병원·의원 추천 — {year}년 업데이트",
    subcategories: [
      {
        slug: "dermatology",
        nameKo: "피부과",
        keywords: ["피부과", "피부과의원", "피부클리닉", "여드름 피부과", "피부과 추천"],
        metaDescriptor: "진료 과목, 전문 분야",
        priority: "high",
      },
      {
        slug: "dental",
        nameKo: "치과",
        keywords: ["치과", "치과의원", "임플란트", "치아교정", "치과 추천"],
        metaDescriptor: "진료 과목, 전문 분야",
        priority: "high",
      },
      {
        slug: "eye",
        nameKo: "안과",
        keywords: ["안과", "안과의원", "라식", "라섹", "백내장", "안과 추천"],
        metaDescriptor: "진료 과목, 전문 분야",
        priority: "high",
      },
      {
        slug: "orthopedics",
        nameKo: "정형외과",
        keywords: ["정형외과", "허리디스크", "관절", "물리치료", "정형외과 추천"],
        metaDescriptor: "진료 과목, 전문 분야",
        priority: "medium",
      },
      {
        slug: "korean-medicine",
        nameKo: "한의원",
        keywords: ["한의원", "침", "추나요법", "한방", "한의원 추천"],
        metaDescriptor: "진료 과목, 전문 분야",
        priority: "medium",
      },
      {
        slug: "ent",
        nameKo: "이비인후과",
        keywords: ["이비인후과", "코골이", "축농증", "편도", "이비인후과 추천"],
        metaDescriptor: "진료 과목, 전문 분야",
        priority: "medium",
      },
      {
        slug: "internal-medicine",
        nameKo: "내과",
        keywords: ["내과", "건강검진", "내과의원", "위내시경", "내과 추천"],
        metaDescriptor: "진료 과목, 전문 분야",
        priority: "medium",
      },
      {
        slug: "obgyn",
        nameKo: "산부인과",
        keywords: ["산부인과", "산부인과의원", "여성의원", "산부인과 추천"],
        metaDescriptor: "진료 과목, 전문 분야",
        priority: "low",
      },
      {
        slug: "pediatrics",
        nameKo: "소아과",
        keywords: ["소아과", "소아청소년과", "아이병원", "소아과 추천"],
        metaDescriptor: "진료 과목, 전문 분야",
        priority: "low",
      },
      {
        slug: "psychiatry",
        nameKo: "정신건강의학과",
        keywords: ["정신과", "심리상담", "정신건강의학과", "우울증", "정신과 추천"],
        metaDescriptor: "진료 과목, 전문 분야",
        priority: "low",
      },
      {
        slug: "rehabilitation",
        nameKo: "재활의학과",
        keywords: ["재활의학과", "물리치료", "재활", "도수치료", "재활의학과 추천"],
        metaDescriptor: "진료 과목, 전문 분야",
        priority: "low",
      },
      {
        slug: "plastic-surgery",
        nameKo: "성형외과",
        keywords: ["성형외과", "코성형", "눈성형", "지방흡입", "성형외과 추천"],
        metaDescriptor: "전문 시술, 가격대",
        priority: "medium",
      },
      {
        slug: "urology",
        nameKo: "비뇨기과",
        keywords: ["비뇨기과", "비뇨의학과", "남성의원", "비뇨기과 추천"],
        metaDescriptor: "진료 과목, 전문 분야",
        priority: "low",
      },
      {
        slug: "pharmacy",
        nameKo: "약국",
        keywords: ["약국", "24시약국", "야간약국", "주말약국", "약국 추천"],
        schemaType: "Pharmacy",
        metaDescriptor: "운영 시간, 위치",
        priority: "medium",
      },
    ],
  },

  // ========== 2. 뷰티 ==========
  {
    slug: "beauty",
    nameKo: "뷰티",
    nameEn: "Beauty",
    icon: "Sparkles",
    schemaType: "BeautySalon",
    metaTemplate: "{city}시에 위치한 {sub} {count}곳. 전문 시술, 가격대, 위치, 리뷰 기반 정리.",
    hubTitle: "{city} 뷰티·미용 추천 — {year}년 업데이트",
    subcategories: [
      {
        slug: "hairsalon",
        nameKo: "미용실",
        keywords: ["미용실", "헤어샵", "머리", "펌", "염색", "미용실 추천"],
        metaDescriptor: "전문 시술, 가격대",
        priority: "high",
      },
      {
        slug: "nail",
        nameKo: "네일샵",
        keywords: ["네일", "네일샵", "젤네일", "네일아트", "네일 추천"],
        metaDescriptor: "전문 시술, 가격대",
        priority: "high",
      },
      {
        slug: "skincare",
        nameKo: "피부관리",
        keywords: ["피부관리", "에스테틱", "피부관리실", "관리샵", "피부관리 추천"],
        metaDescriptor: "관리 종류, 가격대",
        priority: "medium",
      },
      {
        slug: "lash",
        nameKo: "속눈썹",
        keywords: ["속눈썹", "래쉬", "속눈썹연장", "속눈썹펌", "속눈썹 추천"],
        metaDescriptor: "시술 종류, 가격대",
        priority: "medium",
      },
      {
        slug: "waxing",
        nameKo: "왁싱",
        keywords: ["왁싱", "브라질리언왁싱", "왁싱샵", "왁싱 추천"],
        metaDescriptor: "시술 종류, 가격대",
        priority: "low",
      },
      {
        slug: "semi-permanent",
        nameKo: "반영구",
        keywords: ["반영구", "눈썹문신", "반영구화장", "아이라인문신", "반영구 추천"],
        metaDescriptor: "시술 종류, 가격대",
        priority: "low",
      },
      {
        slug: "barbershop",
        nameKo: "바버샵",
        keywords: ["바버샵", "남자헤어", "남자머리", "바버샵 추천"],
        metaDescriptor: "전문 시술, 가격대",
        priority: "low",
      },
      {
        slug: "scalp",
        nameKo: "두피·탈모관리",
        keywords: ["두피관리", "탈모관리", "탈모클리닉", "두피케어", "두피관리 추천"],
        metaDescriptor: "관리 종류, 가격대",
        priority: "medium",
      },
      {
        slug: "diet",
        nameKo: "체형관리",
        keywords: ["체형관리", "다이어트", "바디라인", "셀룰라이트", "체형관리 추천"],
        metaDescriptor: "프로그램, 가격대",
        priority: "low",
      },
    ],
  },

  // ========== 3. 생활서비스 ==========
  {
    slug: "living",
    nameKo: "생활서비스",
    nameEn: "Living",
    icon: "Home",
    schemaType: "HomeAndConstructionBusiness",
    metaTemplate: "{city}시에 위치한 {sub} {count}곳. 서비스 분야, 시공 사례, 위치, 리뷰 기반 정리.",
    hubTitle: "{city} 생활서비스 추천 — {year}년 업데이트",
    subcategories: [
      {
        slug: "interior",
        nameKo: "인테리어",
        keywords: ["인테리어", "리모델링", "인테리어업체", "집수리", "인테리어 추천"],
        metaDescriptor: "시공 분야, 포트폴리오",
        priority: "high",
      },
      {
        slug: "moving",
        nameKo: "이사",
        keywords: ["이사", "포장이사", "이사업체", "원룸이사", "이사 추천"],
        schemaType: "MovingCompany",
        metaDescriptor: "서비스 종류, 가격대",
        priority: "high",
      },
      {
        slug: "cleaning",
        nameKo: "청소",
        keywords: ["청소", "입주청소", "에어컨청소", "청소업체", "청소 추천"],
        schemaType: "LocalBusiness",
        metaDescriptor: "서비스 종류, 가격대",
        priority: "medium",
      },
      {
        slug: "laundry",
        nameKo: "세탁",
        keywords: ["세탁소", "특수세탁", "드라이클리닝", "세탁 추천"],
        schemaType: "LocalBusiness",
        metaDescriptor: "서비스 종류, 가격대",
        priority: "low",
      },
      {
        slug: "repair",
        nameKo: "수리",
        keywords: ["수리", "에어컨수리", "보일러수리", "배관수리", "수리 추천"],
        schemaType: "LocalBusiness",
        metaDescriptor: "수리 분야, 출장 여부",
        priority: "low",
      },
      {
        slug: "hardware",
        nameKo: "시공",
        keywords: ["유리", "방충망", "도배", "장판", "시공 추천"],
        metaDescriptor: "시공 분야, 가격대",
        priority: "low",
      },
      {
        slug: "flower",
        nameKo: "꽃배달",
        keywords: ["꽃배달", "꽃집", "화원", "꽃다발", "꽃배달 추천"],
        schemaType: "Florist",
        metaDescriptor: "상품 종류, 배달 범위",
        priority: "low",
      },
      {
        slug: "pest-control",
        nameKo: "방역·해충",
        keywords: ["방역", "해충퇴치", "바퀴벌레", "쥐퇴치", "방역업체 추천"],
        schemaType: "LocalBusiness",
        metaDescriptor: "서비스 종류, 가격대",
        priority: "low",
      },
      {
        slug: "locksmith",
        nameKo: "열쇠·잠금",
        keywords: ["열쇠", "잠금장치", "도어락", "자물쇠", "열쇠 추천"],
        schemaType: "LocalBusiness",
        metaDescriptor: "서비스 종류, 출장 여부",
        priority: "low",
      },
      {
        slug: "storage",
        nameKo: "창고·보관",
        keywords: ["창고", "짐보관", "셀프스토리지", "이삿짐보관", "창고 추천"],
        schemaType: "LocalBusiness",
        metaDescriptor: "보관 유형, 가격대",
        priority: "low",
      },
    ],
  },

  // ========== 4. 자동차 ==========
  {
    slug: "auto",
    nameKo: "자동차",
    nameEn: "Auto",
    icon: "Car",
    schemaType: "AutoRepair",
    metaTemplate: "{city}시에 위치한 {sub} {count}곳. 정비 분야, 가격대, 위치, 리뷰 기반 정리.",
    hubTitle: "{city} 자동차 서비스 추천 — {year}년 업데이트",
    subcategories: [
      {
        slug: "repair",
        nameKo: "자동차정비",
        keywords: ["자동차정비", "카센터", "자동차수리", "엔진오일", "자동차정비 추천"],
        metaDescriptor: "정비 분야, 가격대",
        priority: "high",
      },
      {
        slug: "wash",
        nameKo: "세차",
        keywords: ["세차", "손세차", "세차장", "자동세차", "세차 추천"],
        schemaType: "LocalBusiness",
        metaDescriptor: "서비스 종류, 가격대",
        priority: "medium",
      },
      {
        slug: "tire",
        nameKo: "타이어",
        keywords: ["타이어", "타이어교체", "타이어샵", "타이어 추천"],
        schemaType: "TireShop",
        metaDescriptor: "취급 브랜드, 가격대",
        priority: "medium",
      },
      {
        slug: "detailing",
        nameKo: "광택·코팅",
        keywords: ["광택", "유리막코팅", "PPF", "자동차코팅", "광택 추천"],
        schemaType: "LocalBusiness",
        metaDescriptor: "시공 종류, 가격대",
        priority: "low",
      },
      {
        slug: "import-repair",
        nameKo: "수입차정비",
        keywords: ["수입차정비", "벤츠정비", "BMW정비", "외제차수리", "수입차정비 추천"],
        metaDescriptor: "취급 브랜드, 정비 분야",
        priority: "low",
      },
      {
        slug: "scrap",
        nameKo: "폐차",
        keywords: ["폐차", "폐차장", "자동차폐차", "폐차 추천"],
        schemaType: "LocalBusiness",
        metaDescriptor: "서비스 종류, 가격대",
        priority: "low",
      },
      {
        slug: "used-car",
        nameKo: "중고차",
        keywords: ["중고차", "중고차매매", "중고차딜러", "중고차 추천"],
        schemaType: "AutoDealer",
        metaDescriptor: "취급 차종, 가격대",
        priority: "medium",
      },
      {
        slug: "rental",
        nameKo: "렌트카",
        keywords: ["렌트카", "렌터카", "자동차렌트", "단기렌트", "렌트카 추천"],
        schemaType: "AutoRental",
        metaDescriptor: "차종, 가격대",
        priority: "low",
      },
    ],
  },

  // ========== 5. 교육 ==========
  {
    slug: "education",
    nameKo: "교육",
    nameEn: "Education",
    icon: "GraduationCap",
    schemaType: "EducationalOrganization",
    metaTemplate: "{city}시에 위치한 {sub} {count}곳. 교육 과정, 수강료, 위치, 리뷰 기반 정리.",
    hubTitle: "{city} 교육·학원 추천 — {year}년 업데이트",
    subcategories: [
      {
        slug: "academy",
        nameKo: "입시학원",
        keywords: ["학원", "수학학원", "영어학원", "입시학원", "학원 추천"],
        metaDescriptor: "교육 과정, 수강료",
        priority: "medium",
      },
      {
        slug: "language",
        nameKo: "어학원",
        keywords: ["어학원", "영어회화", "토익", "중국어", "어학원 추천"],
        metaDescriptor: "교육 과정, 수강료",
        priority: "medium",
      },
      {
        slug: "music",
        nameKo: "음악학원",
        keywords: ["음악학원", "피아노학원", "기타학원", "보컬", "음악학원 추천"],
        metaDescriptor: "레슨 종류, 수강료",
        priority: "low",
      },
      {
        slug: "art",
        nameKo: "미술학원",
        keywords: ["미술학원", "입시미술", "취미미술", "드로잉", "미술학원 추천"],
        metaDescriptor: "교육 과정, 수강료",
        priority: "low",
      },
      {
        slug: "sports",
        nameKo: "체육·운동",
        keywords: ["헬스장", "필라테스", "PT", "요가", "크로스핏", "헬스장 추천"],
        schemaType: "SportsActivityLocation",
        metaDescriptor: "프로그램, 이용료",
        priority: "medium",
      },
      {
        slug: "coding",
        nameKo: "코딩학원",
        keywords: ["코딩학원", "코딩교육", "프로그래밍", "코딩 추천"],
        metaDescriptor: "교육 과정, 수강료",
        priority: "low",
      },
      {
        slug: "vocational",
        nameKo: "자격증·직업",
        keywords: ["자격증학원", "직업훈련", "국비지원", "자격증 추천"],
        metaDescriptor: "교육 과정, 수강료",
        priority: "low",
      },
      {
        slug: "kindergarten",
        nameKo: "유치원·어린이집",
        keywords: ["유치원", "어린이집", "유아교육", "유치원 추천"],
        schemaType: "Preschool",
        metaDescriptor: "교육 프로그램, 운영 시간",
        priority: "medium",
      },
      {
        slug: "taekwondo",
        nameKo: "태권도·무술",
        keywords: ["태권도", "태권도장", "무술", "합기도", "태권도 추천"],
        schemaType: "SportsActivityLocation",
        metaDescriptor: "프로그램, 수강료",
        priority: "low",
      },
      {
        slug: "swimming",
        nameKo: "수영장",
        keywords: ["수영장", "수영강습", "실내수영장", "수영 추천"],
        schemaType: "SportsActivityLocation",
        metaDescriptor: "프로그램, 이용료",
        priority: "low",
      },
      {
        slug: "studycafe",
        nameKo: "독서실·스터디카페",
        keywords: ["독서실", "스터디카페", "자습실", "독서실 추천"],
        schemaType: "LocalBusiness",
        metaDescriptor: "이용 환경, 이용료",
        priority: "low",
      },
    ],
  },

  // ========== 6. 전문서비스 ==========
  {
    slug: "professional",
    nameKo: "전문서비스",
    nameEn: "Professional",
    icon: "Briefcase",
    schemaType: "ProfessionalService",
    metaTemplate: "{city}시에 위치한 {sub} {count}곳. 서비스 분야, 포트폴리오, 위치, 리뷰 기반 정리.",
    hubTitle: "{city} 전문서비스 추천 — {year}년 업데이트",
    subcategories: [
      {
        slug: "webagency",
        nameKo: "웹에이전시",
        keywords: ["웹에이전시", "홈페이지제작", "웹디자인", "웹개발", "웹에이전시 추천"],
        metaDescriptor: "서비스 분야, 포트폴리오",
        priority: "high",
      },
      {
        slug: "legal",
        nameKo: "법률",
        keywords: ["변호사", "법무사", "법률사무소", "법률상담", "변호사 추천"],
        schemaType: "LegalService",
        metaDescriptor: "전문 분야, 상담 방식",
        priority: "medium",
      },
      {
        slug: "tax",
        nameKo: "세무·회계",
        keywords: ["세무사", "회계사무소", "세무상담", "기장대리", "세무사 추천"],
        schemaType: "AccountingService",
        metaDescriptor: "전문 분야, 상담 방식",
        priority: "medium",
      },
      {
        slug: "realestate",
        nameKo: "부동산",
        keywords: ["부동산", "공인중개사", "부동산중개", "아파트매매", "부동산 추천"],
        schemaType: "RealEstateAgent",
        metaDescriptor: "취급 매물, 전문 지역",
        priority: "medium",
      },
      {
        slug: "insurance",
        nameKo: "보험",
        keywords: ["보험", "보험설계사", "보험상담", "보험리모델링", "보험 추천"],
        schemaType: "InsuranceAgency",
        metaDescriptor: "취급 보험사, 전문 분야",
        priority: "low",
      },
      {
        slug: "printing",
        nameKo: "인쇄·간판",
        keywords: ["인쇄소", "간판제작", "현수막", "명함", "인쇄 추천"],
        schemaType: "LocalBusiness",
        metaDescriptor: "제작 종류, 가격대",
        priority: "low",
      },
      {
        slug: "photo",
        nameKo: "사진·영상",
        keywords: ["사진관", "증명사진", "웨딩촬영", "영상제작", "사진관 추천"],
        schemaType: "LocalBusiness",
        metaDescriptor: "촬영 종류, 가격대",
        priority: "low",
      },
      {
        slug: "designagency",
        nameKo: "디자인",
        keywords: ["디자인업체", "로고디자인", "브랜딩", "패키지디자인", "디자인 추천"],
        metaDescriptor: "서비스 분야, 포트폴리오",
        priority: "low",
      },
      {
        slug: "marketing",
        nameKo: "마케팅·광고",
        keywords: ["마케팅대행", "블로그마케팅", "SNS마케팅", "광고대행", "마케팅 추천"],
        metaDescriptor: "서비스 분야, 포트폴리오",
        priority: "low",
      },
    ],
  },

  // ========== 7. 반려동물 ==========
  {
    slug: "pet",
    nameKo: "반려동물",
    nameEn: "Pet",
    icon: "PawPrint",
    schemaType: "LocalBusiness",
    metaTemplate: "{city}시에 위치한 {sub} {count}곳. 전문 분야, 가격대, 위치, 리뷰 기반 정리.",
    hubTitle: "{city} 반려동물 서비스 추천 — {year}년 업데이트",
    subcategories: [
      {
        slug: "vet",
        nameKo: "동물병원",
        keywords: ["동물병원", "24시동물병원", "고양이병원", "동물병원 추천"],
        schemaType: "VeterinaryCare",
        metaDescriptor: "진료 과목, 진료 시간",
        priority: "high",
      },
      {
        slug: "grooming",
        nameKo: "펫미용",
        keywords: ["애견미용", "펫미용", "강아지미용", "고양이미용", "펫미용 추천"],
        metaDescriptor: "시술 종류, 가격대",
        priority: "medium",
      },
      {
        slug: "hotel",
        nameKo: "펫호텔",
        keywords: ["펫호텔", "강아지호텔", "반려동물위탁", "펫시터", "펫호텔 추천"],
        metaDescriptor: "서비스 종류, 가격대",
        priority: "low",
      },
      {
        slug: "shop",
        nameKo: "펫용품",
        keywords: ["펫샵", "반려동물용품", "사료", "펫샵 추천"],
        metaDescriptor: "취급 상품, 브랜드",
        priority: "low",
      },
      {
        slug: "training",
        nameKo: "훈련·교육",
        keywords: ["반려견훈련", "강아지훈련", "펫교육", "반려견훈련 추천"],
        metaDescriptor: "프로그램, 가격대",
        priority: "low",
      },
    ],
  },

  // ========== 8. 웨딩·행사 ==========
  {
    slug: "wedding",
    nameKo: "웨딩·행사",
    nameEn: "Wedding & Events",
    icon: "Heart",
    schemaType: "LocalBusiness",
    metaTemplate: "{city}시에 위치한 {sub} {count}곳. 서비스 종류, 가격대, 위치, 리뷰 기반 정리.",
    hubTitle: "{city} 웨딩·행사 서비스 추천 — {year}년 업데이트",
    subcategories: [
      {
        slug: "wedding-hall",
        nameKo: "웨딩홀",
        keywords: ["웨딩홀", "결혼식장", "예식장", "스몰웨딩", "웨딩홀 추천"],
        schemaType: "EventVenue",
        metaDescriptor: "규모, 가격대",
        priority: "medium",
      },
      {
        slug: "studio",
        nameKo: "스튜디오",
        keywords: ["웨딩스튜디오", "웨딩촬영", "스드메", "웨딩스튜디오 추천"],
        metaDescriptor: "촬영 스타일, 가격대",
        priority: "medium",
      },
      {
        slug: "dress",
        nameKo: "드레스·한복",
        keywords: ["웨딩드레스", "한복대여", "돌잔치한복", "드레스 추천"],
        metaDescriptor: "브랜드, 대여 가격대",
        priority: "low",
      },
      {
        slug: "funeral",
        nameKo: "장례식장",
        keywords: ["장례식장", "장례", "상조", "장례식장 추천"],
        metaDescriptor: "시설, 가격대",
        priority: "medium",
      },
      {
        slug: "catering",
        nameKo: "케이터링·출장뷔페",
        keywords: ["케이터링", "출장뷔페", "돌잔치", "행사음식", "케이터링 추천"],
        metaDescriptor: "메뉴, 가격대",
        priority: "low",
      },
    ],
  },

  // ========== 9. 레저·취미 ==========
  {
    slug: "leisure",
    nameKo: "레저·취미",
    nameEn: "Leisure",
    icon: "Gamepad2",
    schemaType: "EntertainmentBusiness",
    metaTemplate: "{city}시에 위치한 {sub} {count}곳. 이용 정보, 가격대, 위치, 리뷰 기반 정리.",
    hubTitle: "{city} 레저·취미 시설 추천 — {year}년 업데이트",
    subcategories: [
      {
        slug: "kids-cafe",
        nameKo: "키즈카페",
        keywords: ["키즈카페", "아이놀이터", "어린이카페", "키즈카페 추천"],
        metaDescriptor: "시설, 이용료",
        priority: "medium",
      },
      {
        slug: "karaoke",
        nameKo: "노래방",
        keywords: ["노래방", "코인노래방", "노래방 추천"],
        metaDescriptor: "시설, 이용료",
        priority: "low",
      },
      {
        slug: "bowling",
        nameKo: "볼링장",
        keywords: ["볼링장", "볼링", "볼링장 추천"],
        metaDescriptor: "시설, 이용료",
        priority: "low",
      },
      {
        slug: "sauna",
        nameKo: "찜질방·사우나",
        keywords: ["찜질방", "사우나", "대중목욕탕", "찜질방 추천"],
        metaDescriptor: "시설, 이용료",
        priority: "medium",
      },
      {
        slug: "escape-room",
        nameKo: "방탈출",
        keywords: ["방탈출", "방탈출카페", "방탈출 추천"],
        metaDescriptor: "테마, 난이도, 이용료",
        priority: "low",
      },
      {
        slug: "pc-room",
        nameKo: "PC방",
        keywords: ["PC방", "피시방", "게임방", "PC방 추천"],
        metaDescriptor: "시설, 이용료",
        priority: "low",
      },
    ],
  },

  // ========== 10. 음식 ==========
  {
    slug: "food",
    nameKo: "음식",
    nameEn: "Food",
    icon: "UtensilsCrossed",
    schemaType: "Restaurant",
    metaTemplate: "{city}시에 위치한 {sub} {count}곳. 메뉴, 가격대, 위치, 리뷰 기반 정리.",
    hubTitle: "{city} 맛집·카페 추천 — {year}년 업데이트",
    subcategories: [
      {
        slug: "restaurant",
        nameKo: "맛집",
        keywords: ["맛집", "한식", "중식", "일식", "양식", "맛집 추천"],
        metaDescriptor: "메뉴, 가격대",
        priority: "low",
      },
      {
        slug: "cafe",
        nameKo: "카페",
        keywords: ["카페", "분위기좋은카페", "대형카페", "브런치카페", "카페 추천"],
        schemaType: "CafeOrCoffeeShop",
        metaDescriptor: "분위기, 메뉴",
        priority: "low",
      },
      {
        slug: "bakery",
        nameKo: "베이커리",
        keywords: ["빵집", "베이커리", "케이크", "디저트", "빵집 추천"],
        schemaType: "Bakery",
        metaDescriptor: "메뉴, 가격대",
        priority: "low",
      },
      {
        slug: "delivery",
        nameKo: "배달",
        keywords: ["배달맛집", "배달음식", "배달 추천"],
        metaDescriptor: "메뉴, 배달 범위",
        priority: "low",
      },
      {
        slug: "bar",
        nameKo: "술집·바",
        keywords: ["술집", "바", "이자카야", "와인바", "술집 추천"],
        schemaType: "BarOrPub",
        metaDescriptor: "분위기, 메뉴",
        priority: "low",
      },
      {
        slug: "buffet",
        nameKo: "뷔페",
        keywords: ["뷔페", "호텔뷔페", "해산물뷔페", "뷔페 추천"],
        metaDescriptor: "메뉴, 가격대",
        priority: "low",
      },
    ],
  },
];


// --- 유틸리티: 역방향 룩업 ---

/** slug로 대분류 찾기 */
export function getCategoryBySlug(slug: string): Category | undefined {
  return CATEGORIES.find((c) => c.slug === slug);
}

/** slug로 소분류 찾기 (대분류 slug 필요) */
export function getSubCategory(
  categorySlug: string,
  subSlug: string
): SubCategory | undefined {
  return CATEGORIES
    .find((c) => c.slug === categorySlug)
    ?.subcategories.find((s) => s.slug === subSlug);
}

/** 소분류 slug만으로 찾기 (전체 탐색) */
export function findSubCategory(subSlug: string): {
  category: Category;
  sub: SubCategory;
} | undefined {
  for (const cat of CATEGORIES) {
    const sub = cat.subcategories.find((s) => s.slug === subSlug);
    if (sub) return { category: cat, sub };
  }
  return undefined;
}

/** 전체 소분류 flat 목록 */
export function getAllSubCategories(): Array<{
  categorySlug: string;
  categoryNameKo: string;
  sub: SubCategory;
}> {
  return CATEGORIES.flatMap((cat) =>
    cat.subcategories.map((sub) => ({
      categorySlug: cat.slug,
      categoryNameKo: cat.nameKo,
      sub,
    }))
  );
}

/** 우선순위별 필터 */
export function getSubCategoriesByPriority(
  priority: "high" | "medium" | "low"
): Array<{
  categorySlug: string;
  categoryNameKo: string;
  sub: SubCategory;
}> {
  return getAllSubCategories().filter((item) => item.sub.priority === priority);
}


// --- 기존 URL → 신규 URL 리다이렉트 맵 ---

export const LEGACY_REDIRECTS: Record<string, string> = {
  "/cheonan/dermatology":                "/cheonan/medical/dermatology",
  "/cheonan/dermatology/soo-derm":       "/cheonan/medical/dermatology/soo-derm",
  "/cheonan/dermatology/dr-evers":       "/cheonan/medical/dermatology/dr-evers",
  "/cheonan/dermatology/cleanhue":       "/cheonan/medical/dermatology/cleanhue",
  "/cheonan/dermatology/shinebeam":      "/cheonan/medical/dermatology/shinebeam",
  "/cheonan/dermatology/alive-skin":     "/cheonan/medical/dermatology/alive-skin",
  "/cheonan/hairsalon":                  "/cheonan/beauty/hairsalon",
  "/cheonan/interior":                   "/cheonan/living/interior",
  "/cheonan/interior/momeden":           "/cheonan/living/interior/momeden",
  "/cheonan/auto-repair":               "/cheonan/auto/repair",
  "/cheonan/auto-repair/auto-repair-jyw4": "/cheonan/auto/repair/auto-repair-jyw4",
  "/cheonan/webagency":                  "/cheonan/professional/webagency",
  "/cheonan/webagency/didu":             "/cheonan/professional/webagency/didu",
  // 키워드 페이지
  "/cheonan/dermatology/k/acne":         "/cheonan/medical/dermatology/k/acne",
  "/cheonan/dermatology/k/botox":        "/cheonan/medical/dermatology/k/botox",
  "/cheonan/dermatology/k/lifting":      "/cheonan/medical/dermatology/k/lifting",
  "/cheonan/dermatology/k/blemish":      "/cheonan/medical/dermatology/k/blemish",
  "/cheonan/dermatology/k/night-clinic": "/cheonan/medical/dermatology/k/night-clinic",
  "/cheonan/dermatology/k/recommend":    "/cheonan/medical/dermatology/k/recommend",
  "/cheonan/dermatology/k/hair-loss":    "/cheonan/medical/dermatology/k/hair-loss",
  "/cheonan/dermatology/k/scar":         "/cheonan/medical/dermatology/k/scar",
  // 비교 페이지
  "/compare/cheonan/dermatology/acne-treatment":  "/compare/cheonan/medical/dermatology/acne-treatment",
  "/compare/cheonan/dermatology/laser-treatment": "/compare/cheonan/medical/dermatology/laser-treatment",
  "/compare/cheonan/dermatology/anti-aging":      "/compare/cheonan/medical/dermatology/anti-aging",
  // 가이드 페이지
  "/guide/cheonan/dermatology":          "/guide/cheonan/medical/dermatology",
};


// --- 통계 ---
// 대분류: 10개
// 소분류: 83개
//
// high priority (10개):
//   의료: 피부과, 치과, 안과
//   뷰티: 미용실, 네일샵
//   생활: 인테리어, 이사
//   자동차: 자동차정비
//   전문: 웹에이전시
//   반려동물: 동물병원
//
// medium priority (23개):
//   의료: 정형외과, 한의원, 이비인후과, 내과, 성형외과, 약국
//   뷰티: 피부관리, 속눈썹, 두피·탈모관리
//   생활: 청소
//   자동차: 세차, 타이어, 중고차
//   교육: 입시학원, 어학원, 체육·운동, 유치원·어린이집
//   전문: 법률, 세무·회계, 부동산
//   반려동물: 펫미용
//   웨딩: 웨딩홀, 스튜디오, 장례식장
//   레저: 키즈카페, 찜질방·사우나
//
// low priority: 나머지 49개