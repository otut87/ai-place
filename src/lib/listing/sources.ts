// AI Place — 카테고리별 출처·방법론·가격 라벨 카탈로그.
// 메모리 [거짓 정보 생성 금지] · [SEO/GEO/AEO 최우선] 원칙에 따라
// 페이지마다 똑같은 방법론을 노출하지 않고 sector 별로 검증 절차·법규·
// 가격 표현을 차별화. /[city]/[category] 의 Sources 섹션 + ranked 카드의
// "가격대" 라벨이 단일 소스 (이 파일) 에서 결정된다.

export interface ListingSource {
  /** 강조 노출 (사이트 또는 데이터 제공 기관) */
  name: string
  /** 보조 설명 */
  detail: string
}

export interface ListingSourcesConfig {
  sources: ListingSource[]
  methodology: string[]
  /** Ranked 카드/Service 표의 "가격대" 컬럼 라벨 — 카테고리별 도메인 표현 */
  priceLabel: string
}

const BASE_SOURCES: ListingSource[] = [
  { name: '네이버 플레이스', detail: '영업시간·리뷰·주소' },
  { name: 'Google Places API', detail: '평점·리뷰·좌표·운영시간' },
  { name: '업체 직접 제공', detail: '서비스 메뉴·가격표 (서면 제출)' },
  { name: '국세청', detail: '사업자등록번호 검증' },
]

const BASE_METHODOLOGY: string[] = [
  '등록 업체는 사업자등록번호 검증을 통과한 곳만 포함합니다.',
  '평점·리뷰는 Google·네이버·카카오의 공식 데이터를 결합하며 광고 영향을 받지 않습니다.',
  '가격은 업체가 직접 제공한 단가이며 실제 견적은 시기·조건에 따라 다를 수 있습니다.',
  '추천 순위는 평점·리뷰 수의 단순 정렬이며 알고리즘 가중은 적용하지 않습니다.',
]

const SECTOR_OVERRIDES: Record<string, Partial<ListingSourcesConfig>> = {
  medical: {
    sources: [
      { name: '네이버 플레이스', detail: '영업시간·리뷰·주소' },
      { name: 'Google Places API', detail: '평점·리뷰·좌표·운영시간' },
      { name: '업체 직접 제공', detail: '시술 메뉴·가격표 (서면 제출)' },
      { name: '건강보험심사평가원', detail: '의료기관 정보 Open API' },
      { name: '국세청', detail: '사업자등록번호 검증' },
    ],
    methodology: [
      '등록 업체는 의료기관 인허가 + 사업자등록번호 검증을 통과한 곳만 포함합니다.',
      '평점·리뷰는 Google·네이버·카카오의 공식 데이터를 결합하며 광고 영향을 받지 않습니다.',
      '시술 가격은 업체 제공가이며, 실제 견적은 진단·체질·시기에 따라 다를 수 있습니다.',
      '의료광고법에 따라 시술 효과는 개인차가 있으며 부작용 가능성이 있음을 고지합니다.',
      '추천 순위는 평점·리뷰 수의 단순 정렬이며 알고리즘 가중·광고는 적용하지 않습니다.',
    ],
    priceLabel: '시술 시작가',
  },

  beauty: {
    sources: [
      { name: '네이버 플레이스', detail: '영업시간·리뷰·주소' },
      { name: 'Google Places API', detail: '평점·리뷰·좌표·운영시간' },
      { name: '업체 직접 제공', detail: '시술 메뉴·가격표 (서면 제출)' },
      { name: '보건복지부', detail: '공중위생관리법 영업신고 정보' },
      { name: '국세청', detail: '사업자등록번호 검증' },
    ],
    methodology: [
      '등록 업체는 사업자등록번호 + 공중위생관리법 영업신고 검증을 거칩니다.',
      '평점·리뷰는 Google·네이버·카카오의 공식 데이터를 결합하며 광고 영향을 받지 않습니다.',
      '시술 가격은 업체 제공가이며, 실제 비용은 시술 종류·횟수·체질에 따라 다를 수 있습니다.',
      '추천 순위는 평점·리뷰 수의 단순 정렬이며 알고리즘 가중은 적용하지 않습니다.',
    ],
    priceLabel: '시술 단가',
  },

  living: {
    sources: [
      { name: '네이버 플레이스', detail: '영업시간·리뷰·주소' },
      { name: 'Google Places API', detail: '평점·리뷰·좌표·운영시간' },
      { name: '업체 직접 제공', detail: '시공 사례·평당 단가 (서면 제출)' },
      { name: '국토교통부 KISCON', detail: '실내건축업·건설업 면허 검증' },
      { name: '국세청', detail: '사업자등록번호 검증' },
    ],
    methodology: [
      '등록 업체는 사업자등록번호 + (해당 시) 실내건축업·건설업 면허 검증을 거칩니다.',
      '평점·리뷰는 Google·네이버·카카오의 공식 데이터를 결합하며 광고 영향을 받지 않습니다.',
      '가격대는 업체가 제공한 단가이며 실제 견적은 평수·자재·시공 범위에 따라 크게 달라집니다.',
      '추천 순위는 평점·리뷰 수의 단순 정렬이며 알고리즘 가중은 적용하지 않습니다.',
    ],
    priceLabel: '기본 단가',
  },

  auto: {
    sources: [
      { name: '네이버 플레이스', detail: '영업시간·리뷰·주소' },
      { name: 'Google Places API', detail: '평점·리뷰·좌표·운영시간' },
      { name: '업체 직접 제공', detail: '정비 항목·공임표 (서면 제출)' },
      { name: '국토교통부', detail: '자동차관리법 정비업 등록 정보' },
      { name: '국세청', detail: '사업자등록번호 검증' },
    ],
    methodology: [
      '등록 업체는 사업자등록번호 + 자동차관리법 정비업 등록 검증을 거칩니다.',
      '평점·리뷰는 Google·네이버·카카오의 공식 데이터를 결합하며 광고 영향을 받지 않습니다.',
      '정비 단가는 업체 제공가이며, 실제 청구 금액은 차종·고장 진단·부품가에 따라 다릅니다.',
      '추천 순위는 평점·리뷰 수의 단순 정렬이며 알고리즘 가중은 적용하지 않습니다.',
    ],
    priceLabel: '정비 단가',
  },

  food: {
    sources: [
      { name: '네이버 플레이스', detail: '영업시간·리뷰·주소' },
      { name: 'Google Places API', detail: '평점·리뷰·좌표·운영시간' },
      { name: '업체 직접 제공', detail: '메뉴·가격 (서면 제출)' },
      { name: '식품의약품안전처', detail: '식품위생법 영업신고 + 위생등급제' },
      { name: '국세청', detail: '사업자등록번호 검증' },
    ],
    methodology: [
      '등록 업체는 사업자등록번호 + 식품위생법 영업신고 검증을 거칩니다.',
      '평점·리뷰는 Google·네이버·카카오의 공식 데이터를 결합하며 광고 영향을 받지 않습니다.',
      '메뉴 가격은 업체 제공가이며, 시기·코스·옵션에 따라 다를 수 있습니다.',
      '추천 순위는 평점·리뷰 수의 단순 정렬이며 알고리즘 가중은 적용하지 않습니다.',
    ],
    priceLabel: '대표 메뉴 가격',
  },

  education: {
    sources: [
      { name: '네이버 플레이스', detail: '영업시간·리뷰·주소' },
      { name: 'Google Places API', detail: '평점·리뷰·좌표·운영시간' },
      { name: '업체 직접 제공', detail: '커리큘럼·수강료 (서면 제출)' },
      { name: '시·도 교육청', detail: '학원의 설립·운영 등록 정보' },
      { name: '국세청', detail: '사업자등록번호 검증' },
    ],
    methodology: [
      '등록 업체는 사업자등록번호 + 학원법 설립·운영 등록 검증을 거칩니다.',
      '평점·리뷰는 Google·네이버·카카오의 공식 데이터를 결합하며 광고 영향을 받지 않습니다.',
      '수강료는 업체 제공가이며, 과정·기간·교재에 따라 다를 수 있습니다.',
      '추천 순위는 평점·리뷰 수의 단순 정렬이며 알고리즘 가중은 적용하지 않습니다.',
    ],
    priceLabel: '월 수강료',
  },

  professional: {
    sources: [
      { name: '네이버 플레이스', detail: '영업시간·리뷰·주소' },
      { name: 'Google Places API', detail: '평점·리뷰·좌표·운영시간' },
      { name: '업체 직접 제공', detail: '서비스 범위·견적 (서면 제출)' },
      { name: '국세청', detail: '사업자등록번호 검증' },
    ],
    methodology: [
      '등록 업체는 사업자등록번호 검증을 통과한 곳만 포함합니다.',
      '평점·리뷰는 Google·네이버·카카오의 공식 데이터를 결합하며 광고 영향을 받지 않습니다.',
      '수임료·견적은 업체 제공가이며, 사건 유형·복잡도에 따라 다를 수 있습니다.',
      '변호사법·세무사법 등 직역별 광고 규제를 준수하여 작성됩니다.',
      '추천 순위는 평점·리뷰 수의 단순 정렬이며 알고리즘 가중은 적용하지 않습니다.',
    ],
    priceLabel: '기본 견적',
  },

  pet: {
    sources: [
      { name: '네이버 플레이스', detail: '영업시간·리뷰·주소' },
      { name: 'Google Places API', detail: '평점·리뷰·좌표·운영시간' },
      { name: '업체 직접 제공', detail: '진료·관리 항목 (서면 제출)' },
      { name: '농림축산식품부', detail: '수의사법 동물병원 개설신고 정보' },
      { name: '국세청', detail: '사업자등록번호 검증' },
    ],
    methodology: [
      '등록 업체는 사업자등록번호 + (해당 시) 수의사법 동물병원 개설신고 검증을 거칩니다.',
      '평점·리뷰는 Google·네이버·카카오의 공식 데이터를 결합하며 광고 영향을 받지 않습니다.',
      '진료·관리 비용은 업체 제공가이며, 동물 종·체중·진단에 따라 다를 수 있습니다.',
      '추천 순위는 평점·리뷰 수의 단순 정렬이며 알고리즘 가중은 적용하지 않습니다.',
    ],
    priceLabel: '진료 단가',
  },

  wedding: {
    methodology: [
      '등록 업체는 사업자등록번호 검증을 통과한 곳만 포함합니다.',
      '평점·리뷰는 Google·네이버·카카오의 공식 데이터를 결합하며 광고 영향을 받지 않습니다.',
      '가격은 업체 제공가이며, 시즌·옵션·하객 수에 따라 변동이 큽니다.',
      '추천 순위는 평점·리뷰 수의 단순 정렬이며 알고리즘 가중은 적용하지 않습니다.',
    ],
    priceLabel: '패키지 단가',
  },

  leisure: {
    methodology: [
      '등록 업체는 사업자등록번호 검증을 통과한 곳만 포함합니다.',
      '평점·리뷰는 Google·네이버·카카오의 공식 데이터를 결합하며 광고 영향을 받지 않습니다.',
      '이용료는 업체 제공가이며, 회원권·횟수권 옵션에 따라 다를 수 있습니다.',
      '추천 순위는 평점·리뷰 수의 단순 정렬이며 알고리즘 가중은 적용하지 않습니다.',
    ],
    priceLabel: '이용 단가',
  },
}

/**
 * 카테고리/sector 에 맞는 출처·방법론·가격 라벨 반환.
 * sector override 가 부분만 정의되어 있으면 base 와 병합.
 */
export function getSourcesForCategory(opts: { sectorSlug?: string }): ListingSourcesConfig {
  const override = opts.sectorSlug ? SECTOR_OVERRIDES[opts.sectorSlug] : undefined
  return {
    sources: override?.sources ?? BASE_SOURCES,
    methodology: override?.methodology ?? BASE_METHODOLOGY,
    priceLabel: override?.priceLabel ?? '기본 단가',
  }
}
