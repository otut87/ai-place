// Few-Shot Exemplars (T-026)
// 카테고리별 우수 등록 사례를 프롬프트에 주입하여
// description / services / FAQ / tags 품질을 끌어올린다.
//
// 원칙:
// - 각 exemplar 은 실제 품질 검수된 샘플이다.
// - 주입 시에는 카테고리 매칭, 없으면 default 가 쓰인다.
// - 프롬프트는 <exemplars>...</exemplars><target>...</target> 구조.
//
// 확장: 카테고리 추가 시 EXEMPLARS_BY_CATEGORY 맵에만 추가.

export interface Exemplar {
  name: string
  category: string
  location: string
  description: string // 40~60자, Direct Answer Block
  services: Array<{ name: string; description: string; priceRange: string }>
  faqs: Array<{ question: string; answer: string }>
  tags: string[]
}

const DERMATOLOGY_EXEMPLAR_1: Exemplar = {
  name: '닥터에버스',
  category: 'dermatology',
  location: '충남 천안시 서북구 불당동',
  description: '천안 불당동 위치. 여드름·리프팅 특화 피부과 전문.',
  services: [
    { name: '여드름 레이저', description: 'PDT·레이저 병행으로 염증성 여드름 집중 관리.', priceRange: '5~12만원' },
    { name: '리프팅 (인모드·울쎄라)', description: '볼·턱선 탄력 개선, 1회 효과 뚜렷.', priceRange: '25~55만원' },
    { name: '스킨부스터', description: '리쥬란·쥬베룩 등 피부결 개선 주사.', priceRange: '18~35만원' },
  ],
  faqs: [
    { question: '닥터에버스는 주차 가능한가요?', answer: '불당동 본원 건물 지하 주차장을 2시간 무료 이용할 수 있습니다.' },
    { question: '닥터에버스 평일 야간 진료 되나요?', answer: '화·목요일 20시까지 진료하며 예약 없이도 방문이 가능합니다.' },
    { question: '닥터에버스 리프팅 가격은 얼마인가요?', answer: '부위·장비에 따라 25만원(부분)~55만원대(전체)입니다.' },
    { question: '닥터에버스 여드름은 몇 회 받아야 하나요?', answer: '염증 정도에 따라 3~6회 코스를 권장합니다.' },
    { question: '닥터에버스 초진 상담료는 있나요?', answer: '초진 상담료는 별도로 청구하지 않습니다.' },
  ],
  tags: ['천안 피부과', '불당 피부과', '여드름 레이저', '리프팅', '인모드', '스킨부스터', '야간 진료'],
}

const DERMATOLOGY_EXEMPLAR_2: Exemplar = {
  name: '샤인빔의원',
  category: 'dermatology',
  location: '충남 천안시 서북구 두정동',
  description: '천안 두정동 위치. 미용 피부 장비 10종 보유 전문.',
  services: [
    { name: '울쎄라 리프팅', description: '깊은 SMAS 층 자극으로 장기 리프팅 효과.', priceRange: '45~80만원' },
    { name: '브이빔 퍼펙타', description: '홍조·모세혈관 확장증 특화 레이저.', priceRange: '15~30만원' },
    { name: '피부관리 (기본)', description: '각질·염증 케어 + 진정 마스크.', priceRange: '4~7만원' },
  ],
  faqs: [
    { question: '샤인빔의원은 예약 없이 가도 되나요?', answer: '가능하나 대기가 1~2시간 발생하므로 전화 예약을 권장합니다.' },
    { question: '샤인빔의원 울쎄라 1회로 효과 보나요?', answer: '1회에도 리프팅감이 있지만 12개월 유지에는 연 2회를 추천합니다.' },
    { question: '샤인빔의원 홍조 치료 몇 번 필요한가요?', answer: '보통 3~5회, 심한 경우 6회 이상 필요합니다.' },
    { question: '샤인빔의원 수납은 카드 되나요?', answer: '모든 카드사 일시·할부 결제 가능합니다.' },
  ],
  tags: ['천안 피부과', '두정 피부과', '울쎄라', '브이빔', '홍조 치료', '피부관리'],
}

const DENTAL_EXEMPLAR: Exemplar = {
  name: '천안서울치과',
  category: 'dental',
  location: '충남 천안시 동남구 신부동',
  description: '천안 신부동 위치. 임플란트·교정 특화 치과 전문.',
  services: [
    { name: '임플란트', description: '국산(오스템)·수입(스트라우만) 선택 가능.', priceRange: '80~150만원' },
    { name: '투명교정', description: '인비절라인 풀케이스 제공.', priceRange: '400~700만원' },
    { name: '라미네이트', description: '전치부 4~8개 심미 개선.', priceRange: '50~80만원/개' },
  ],
  faqs: [
    { question: '천안서울치과 임플란트 당일 가능한가요?', answer: 'CBCT 촬영 후 잇몸 상태에 따라 당일 식립이 가능합니다.' },
    { question: '천안서울치과 교정 상담료 있나요?', answer: '초진 상담·엑스레이 무료, 정밀 진단은 5만원입니다.' },
    { question: '천안서울치과 주차 되나요?', answer: '건물 지하 주차 2시간 무료입니다.' },
  ],
  tags: ['천안 치과', '신부 치과', '임플란트', '투명교정', '라미네이트', '치아교정'],
}

const DEFAULT_EXEMPLAR: Exemplar = {
  name: '예시업체',
  category: 'default',
  location: '대한민국 서울시 강남구',
  description: '강남 위치. 구체적 전문 분야 한 줄로 요약한 업체.',
  services: [
    { name: '대표 서비스 1', description: '실제 리뷰 기반 구체 설명 1~2문장.', priceRange: '5~10만원' },
    { name: '대표 서비스 2', description: '실제 리뷰 기반 구체 설명 1~2문장.', priceRange: '10~20만원' },
  ],
  faqs: [
    { question: '예시업체 예약 방법은?', answer: '전화 또는 카카오톡 예약이 가능합니다.' },
    { question: '예시업체 주차 가능한가요?', answer: '건물 지하 주차장 2시간 무료 지원합니다.' },
    { question: '예시업체 가격은 얼마인가요?', answer: '대표 서비스 기준 5~20만원대입니다.' },
  ],
  tags: ['대표 키워드 1', '대표 키워드 2', '지역 키워드'],
}

const EXEMPLARS_BY_CATEGORY: Record<string, Exemplar[]> = {
  dermatology: [DERMATOLOGY_EXEMPLAR_1, DERMATOLOGY_EXEMPLAR_2],
  dental: [DENTAL_EXEMPLAR],
}

export function getExemplars(category: string, limit = 2): Exemplar[] {
  const exact = EXEMPLARS_BY_CATEGORY[category]
  if (exact && exact.length > 0) return exact.slice(0, limit)
  return [DEFAULT_EXEMPLAR]
}

function exemplarToText(ex: Exemplar): string {
  const services = ex.services
    .map(s => `    - ${s.name} (${s.priceRange}): ${s.description}`)
    .join('\n')
  const faqs = ex.faqs.map(f => `    Q: ${f.question}\n    A: ${f.answer}`).join('\n')
  const tags = ex.tags.join(', ')
  return [
    `<example>`,
    `  이름: ${ex.name}`,
    `  카테고리: ${ex.category}`,
    `  위치: ${ex.location}`,
    `  설명 (40~60자): ${ex.description}`,
    `  서비스:\n${services}`,
    `  FAQ:\n${faqs}`,
    `  태그: ${tags}`,
    `</example>`,
  ].join('\n')
}

export function buildExemplarBlock(exemplars: Exemplar[]): string {
  if (exemplars.length === 0) return ''
  return [
    '<exemplars>',
    '다음은 품질 검수된 등록 사례입니다. 톤·구체성·AEO(Direct Answer Block) 패턴을 따르되 내용은 타겟 업체에 맞춰 새로 만드세요.',
    '',
    ...exemplars.map(exemplarToText),
    '</exemplars>',
  ].join('\n')
}
