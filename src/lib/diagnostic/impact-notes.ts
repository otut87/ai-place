// T-147 — 각 체크 실패 시 예상 영향 수치화.
// 근거: docs/GEO-SEO-AEO-딥리서치.md 본문 인용.

import type { CheckId } from './scan-site'

export interface ImpactNote {
  expectedEffect: string          // 예: "AI 인용률 +28% (FAQ Schema)"
  source: string                  // 근거 문서 표기
}

const IMPACT: Partial<Record<CheckId, ImpactNote>> = {
  jsonld_localbusiness: {
    expectedEffect: 'AI가 업체를 인용하는 전제조건. 없으면 인용 풀에 아예 진입하지 못함',
    source: 'GEO §5.3 · Google Local Business Structured Data',
  },
  robots_ai_allow: {
    expectedEffect: '차단 시 ChatGPT·Perplexity·Claude 답변에서 완전히 제외',
    source: 'GEO §5.1 · ALM Corp 2026',
  },
  faq_schema: {
    expectedEffect: 'AI 인용률 2.7~3.2배 증가 (단일 최고 ROI 레버)',
    source: 'GEO §4.3 · WPRiders/Relixir 2025',
  },
  review_schema: {
    expectedEffect: 'AggregateRating은 AI가 인용 시 제시하는 핵심 수치 신호',
    source: 'GEO §3.1 · Seer Interactive',
  },
  breadcrumb_schema: {
    expectedEffect: 'Google Rich Results 선정률 상승 + AI 경로 파악 개선',
    source: 'GEO §5.3',
  },
  direct_answer_block: {
    expectedEffect: 'AEO 단일 최대 기여 레버 — 스니펫·음성 답변 선정률 증가',
    source: 'GEO §4.4 · GenOptima 2026',
  },
  sameas_entity_linking: {
    expectedEffect: 'Knowledge Graph 엔티티 매칭 — 멀티 플랫폼 존재감 확인 4분면 내 2.8배',
    source: 'GEO §5.3 · Otterly 2026',
  },
  last_updated: {
    expectedEffect: 'ChatGPT 인용률 2.3배 (90일 이내 갱신 기준)',
    source: 'GEO §4.2 · Seer Interactive',
  },
  time_markup: {
    expectedEffect: 'Freshness 구조 시그널 보완 — dateModified 와 조합 시 효과',
    source: 'GEO §4.2',
  },
  author_person_schema: {
    expectedEffect: 'E-E-A-T 강화 — AI 검색 인용률 평균 +40%',
    source: 'GEO §4.1 · BrightEdge',
  },
  title: {
    expectedEffect: 'Google 검색결과 CTR + AI 인용 시 타이틀 그대로 노출',
    source: 'SEO 기본',
  },
  meta_description: {
    expectedEffect: 'Google 검색결과 스니펫 · AI가 요약 생성 시 참조',
    source: 'SEO 기본',
  },
  sitemap: {
    expectedEffect: '없으면 AI 크롤러가 상세 페이지 발견 불가 — 사실상 미인덱싱',
    source: 'GEO §5.4',
  },
  llms_txt: {
    expectedEffect: '저비용 보너스 — AI에게 핵심 페이지 큐레이션 알림 (선택)',
    source: 'GEO §5.2',
  },
  https: {
    expectedEffect: 'HTTP는 AI 크롤러 신뢰도 저하 · 브라우저 경고',
    source: 'SEO 기본',
  },
  viewport: {
    expectedEffect: '모바일 Core Web Vitals · Google 검색 모바일 페널티',
    source: 'SEO 기본',
  },
}

export function getImpactNote(id: CheckId): ImpactNote | null {
  return IMPACT[id] ?? null
}
