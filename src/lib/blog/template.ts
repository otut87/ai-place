// T-111 — 블로그 본문 7블록 템플릿.
// 철학: Direct Answer Block(40~80자) 을 긴 콘텐츠로 확장.
// MedicalKoreaGuide 분석 결과를 사이트 단일 구조로 표준화.

export type BlockId =
  | 'conclusion'   // 결론 (Direct Answer)
  | 'methodology'  // 분석 방법
  | 'detail'       // 병원별/업체별 상세
  | 'comparison'   // 비교표
  | 'checklist'    // 체크리스트
  | 'warning'      // 위험 신호 / 주의 사항
  | 'faq'          // FAQ + 면책

export interface TemplateBlock {
  id: BlockId
  title: string
  headingPattern: RegExp     // 본문 H2 매칭 패턴
  minContentLength: number   // 해당 블록 본문 최소 길이
  description: string
  required: boolean
}

const BASE_BLOCKS: TemplateBlock[] = [
  {
    id: 'conclusion',
    title: '결론',
    headingPattern: /^##\s*(결론|요약|한 줄 요약)/m,
    minContentLength: 40,
    description: '40~80자 Direct Answer Block. 독자가 스크롤 없이 답을 얻어야 한다.',
    required: true,
  },
  {
    id: 'methodology',
    title: '분석 방법',
    headingPattern: /^##\s*(분석 방법|조사 방법|평가 기준|선정 기준)/m,
    minContentLength: 60,
    description: '데이터 출처·표본·기간·가중치. /about/methodology 링크로 보강.',
    required: true,
  },
  {
    id: 'detail',
    title: '업체별 상세',
    headingPattern: /^##\s*(업체별 상세|상세 정보|병원별|[가-힣0-9]+곳\s*자세히|상세 분석)/m,
    minContentLength: 200,
    description: '각 업체의 특징·실적·리뷰 요약. H3 당 1개 업체.',
    required: true,
  },
  {
    id: 'comparison',
    title: '비교표',
    headingPattern: /^##\s*(비교|비교표|한눈에 비교|요약표)/m,
    minContentLength: 80,
    description: 'HTML `<table>` 로 렌더. 가격·거리·전문의 등 핵심 지표.',
    required: true,
  },
  {
    id: 'checklist',
    title: '체크리스트',
    headingPattern: /^##\s*(체크리스트|확인사항|선택 시 체크|고르는 법)/m,
    minContentLength: 60,
    description: '방문·상담 전 확인할 6~10개 항목.',
    required: true,
  },
  {
    id: 'warning',
    title: '위험 신호',
    headingPattern: /^##\s*(위험 신호|주의|경계|피해야 할|주의 사항)/m,
    minContentLength: 40,
    description: '3~6개의 위험 신호. 의료·법률·세무는 필수.',
    required: true,
  },
  {
    id: 'faq',
    title: 'FAQ + 면책',
    headingPattern: /^##\s*(자주 묻는|FAQ|질문|면책)/m,
    minContentLength: 80,
    description: '3~5개 FAQ + 컴플라이언스 면책 문구.',
    required: true,
  },
]

/** 카테고리별 섹션 오버라이드 (예: 의료 카테고리는 '의료 광고 면책' 강조). */
const CATEGORY_OVERRIDES: Record<string, Partial<Record<BlockId, Partial<TemplateBlock>>>> = {
  medical: {
    warning: {
      description: '규제·부작용·위험 신호. 의료법 56조 위반 표현 배제.',
      minContentLength: 60,
    },
    faq: {
      description: 'FAQ + 의료 광고 면책 문구 (치료 효과 개인차 고지 필수).',
    },
  },
  legal: {
    warning: { description: '법률 분쟁 전 확인해야 할 위험 신호. 구체 판례 금지.' },
    faq: { description: 'FAQ + 변호사법 준수 면책.' },
  },
  tax: {
    warning: { description: '세무 실수 유발 위험 신호. 구체 절세 컨설팅 금지.' },
    faq: { description: 'FAQ + 세무사법 준수 면책.' },
  },
}

/** 카테고리 또는 섹터 slug 로 7블록 스켈레톤 반환. */
export function getSevenBlockTemplate(sectorOrCategory?: string): TemplateBlock[] {
  const override = sectorOrCategory ? CATEGORY_OVERRIDES[sectorOrCategory] : undefined
  if (!override) return BASE_BLOCKS
  return BASE_BLOCKS.map(block => {
    const o = override[block.id]
    return o ? { ...block, ...o } : block
  })
}

export interface SevenBlockValidation {
  passed: number            // 통과한 블록 수 (0-7)
  total: number             // 전체 필수 블록 수 (7)
  passRate: number          // passed / total (0-1)
  missing: BlockId[]        // 누락된 블록 ID
  short: BlockId[]          // 길이 부족한 블록 ID
}

/** Markdown 본문을 7블록 규격으로 검증. */
export function validateSevenBlocks(
  markdown: string,
  sectorOrCategory?: string,
): SevenBlockValidation {
  const template = getSevenBlockTemplate(sectorOrCategory)
  const required = template.filter(b => b.required)
  const missing: BlockId[] = []
  const short: BlockId[] = []
  let passed = 0

  for (const block of required) {
    const match = markdown.match(block.headingPattern)
    if (!match) {
      missing.push(block.id)
      continue
    }
    const startIdx = match.index ?? 0
    const nextH2 = markdown.slice(startIdx + match[0].length).search(/^##\s/m)
    const blockBody = nextH2 === -1
      ? markdown.slice(startIdx + match[0].length)
      : markdown.slice(startIdx + match[0].length, startIdx + match[0].length + nextH2)
    if (blockBody.trim().length < block.minContentLength) {
      short.push(block.id)
      continue
    }
    passed += 1
  }

  return {
    passed,
    total: required.length,
    passRate: required.length === 0 ? 1 : passed / required.length,
    missing,
    short,
  }
}

/** 관리자 UI 용 — 블록별 통과/미통과 레코드. */
export function getBlockChecklist(
  markdown: string,
  sectorOrCategory?: string,
): Array<{ block: TemplateBlock; status: 'ok' | 'missing' | 'short' }> {
  const template = getSevenBlockTemplate(sectorOrCategory)
  const validation = validateSevenBlocks(markdown, sectorOrCategory)
  return template.map(block => {
    let status: 'ok' | 'missing' | 'short' = 'ok'
    if (validation.missing.includes(block.id)) status = 'missing'
    else if (validation.short.includes(block.id)) status = 'short'
    return { block, status }
  })
}
