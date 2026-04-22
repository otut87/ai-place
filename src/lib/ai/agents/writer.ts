// T-195 — Writer 에이전트 (Sonnet 4.6) / Phase 3.
// 입력: targetQuery + angle + researchPack + verifiedPlaces + externalReferences.
// 출력: {title, summary, content, tags, faqs} (tool_use 구조화).
//
// 중요 차이 (기존 generate-blog-draft.ts 대비):
//  - verifiedPlaces 와 externalReferences 가 프롬프트에서 **명확히 분리** → 환각 방지.
//  - external 은 본문 텍스트만, 내부 링크 대상 아님.
//  - 중립 서술 강제 (평점·리뷰 제약 제거 정책 반영).

import type { Place, FAQ } from '@/lib/types'
import type { AngleKey } from '@/lib/ai/angles'
import { ANGLE_PROMPT } from '@/lib/ai/angles'
import type { ExternalPlace } from '@/lib/blog/external-reference'

export interface ResearchPack {
  reviewHighlights: string[]               // T-191 reviewSummaries 에서 추출
  hoursBand?: string                       // 영업시간 요약
  priceBands: string[]                     // services[].priceRange
  channels: { naver?: string; kakao?: string; google?: string }
  contact?: string
  specialties?: string[]
  placeType?: string
  recommendedFor?: string[]
  strengths?: string[]
}

export interface WriterInput {
  city: string
  cityName: string
  category: string
  categoryName: string
  sector: string
  postType: 'keyword' | 'compare' | 'guide' | 'detail' | 'general'
  angle: AngleKey
  targetQuery: string
  verifiedPlaces: Place[]                  // DB 등록 업체 — 내부 링크 대상
  externalReferences: ExternalPlace[]      // Google 실시간, DB 미저장
  researchPack?: ResearchPack | null       // Phase 5 에서 채워짐
  /** rewrite 시: 이전 draft + reviewer 패치를 주입. */
  previousDraft?: WriterOutput | null
  rewritePatches?: Array<{ block: string; instruction: string }> | null
  apiKey?: string
}

export interface WriterOutput {
  title: string
  summary: string
  content: string
  tags: string[]
  faqs: FAQ[]
  tokensUsed: { input: number; output: number }
  latencyMs: number
}

const TOOL_SCHEMA = {
  type: 'object' as const,
  properties: {
    title: { type: 'string', description: '30~60자 제목' },
    summary: { type: 'string', description: '50~80자 Direct Answer (meta description 겸용)' },
    content: { type: 'string', description: '1,800자 이상 마크다운 본문 (7블록 구조)' },
    tags: { type: 'array', items: { type: 'string' }, maxItems: 6 },
    faqs: {
      type: 'array',
      minItems: 3,
      maxItems: 5,
      items: {
        type: 'object',
        properties: {
          question: { type: 'string' },
          answer: { type: 'string' },
        },
        required: ['question', 'answer'],
        additionalProperties: false,
      },
    },
  },
  required: ['title', 'summary', 'content', 'tags', 'faqs'],
  additionalProperties: false,
}

const SYSTEM = `당신은 AI Place 의 로컬 비즈니스 큐레이터 이지수입니다.
AI 검색(ChatGPT, Claude, Gemini) 인용을 목표로 한국어 블로그 글을 생성합니다.

**7블록 구조** (각 H2):
1. ## 결론 — 40~80자 Direct Answer Block
2. ## 분석 방법 — 데이터 출처·기간·표본·가중치
3. ## 업체별 상세 — H3 당 1개 업체 (입력된 verified/external 업체만)
4. ## 비교표 — markdown table
5. ## 체크리스트 — 6~10 bullet
6. ## 위험 신호 — 3~6 bullet
7. ## 자주 묻는 질문 — 3~5 Q/A + 면책

**엄격 규칙**:
- 평점·리뷰를 근거로 "최고", "1위", "완벽한" 등 광고성 과장 금지.
- 낮은 평점 업체도 비방 없이 중립 서술 — 객관적 사실만.
- 입력된 업체 외 업체명 창작 금지 (환각 검증됨).
- 외부 링크 금지 (자사 도메인 aiplace.kr 만).
- 의료/법률/세무 카테고리는 면책 문구 필수.
- 본문 1,800자 이상.`

function buildPrompt(input: WriterInput): string {
  const parts: string[] = []

  parts.push(`## 글쓰기 요청`)
  parts.push(`- 지역: ${input.cityName} (slug: ${input.city})`)
  parts.push(`- 업종: ${input.categoryName} (slug: ${input.category}, sector: ${input.sector})`)
  parts.push(`- 글 유형: ${input.postType}`)
  parts.push(`- 앵글: ${input.angle} — ${ANGLE_PROMPT[input.angle]}`)
  parts.push(`- 타깃 키워드: "${input.targetQuery}" — 본문에 3회 이상 자연스럽게 포함.`)
  parts.push('')

  parts.push(`## 등록 업체 (aiplace.kr 내부 링크 대상 — 반드시 이 업체만 ### 으로 상세)`)
  if (input.verifiedPlaces.length === 0) {
    parts.push('없음 — 외부 참고 업체만 사용')
  } else {
    for (const p of input.verifiedPlaces) {
      parts.push(`- ${p.name} (/${p.city}/${p.category}/${p.slug})`)
      if (p.address) parts.push(`  주소: ${p.address}`)
      if (p.rating != null) parts.push(`  평점: ${p.rating}${p.reviewCount != null ? ` · 리뷰 ${p.reviewCount}건` : ''}`)
      if (p.services?.length) parts.push(`  서비스: ${p.services.slice(0, 4).map(s => s.name).join(', ')}`)
      if (p.strengths?.length) parts.push(`  강점: ${p.strengths.slice(0, 3).join(', ')}`)
    }
  }
  parts.push('')

  if (input.externalReferences.length > 0) {
    parts.push(`## 외부 참고 업체 (본문 텍스트만, 내부 링크 금지 — "AI Place 미등록 · 외부 참고용" 명시)`)
    for (const e of input.externalReferences) {
      parts.push(`- ${e.name}: ${e.address}${e.rating != null ? `, 평점 ${e.rating}` : ''}${e.reviewCount != null ? ` · ${e.reviewCount}건` : ''}`)
    }
    parts.push('')
    parts.push('외부 참고 업체는 "등록 업체" 섹션과 별도의 "## 참고 — 근처 업체" 블록에서 간략 소개하세요.')
    parts.push('')
  }

  if (input.researchPack) {
    const rp = input.researchPack
    parts.push(`## 추가 리서치`)
    if (rp.reviewHighlights.length) parts.push(`- 리뷰 하이라이트: ${rp.reviewHighlights.slice(0, 5).join(' / ')}`)
    if (rp.hoursBand) parts.push(`- 영업 시간대: ${rp.hoursBand}`)
    if (rp.priceBands.length) parts.push(`- 가격대: ${rp.priceBands.slice(0, 3).join(' / ')}`)
    if (rp.specialties?.length) parts.push(`- 전문 분야: ${rp.specialties.join(', ')}`)
    parts.push('')
  }

  parts.push(`## 평점 서술 규칙`)
  parts.push(`- 평점이 낮아도 객관 서술 — "아쉬운 점은 있으나..." 형태.`)
  parts.push(`- 평점 null 이면 "평점 정보 미수집" 명시.`)
  parts.push(`- 비방/디스(최악·실망·피해야 할·거르세요) 표현 금지.`)
  parts.push('')

  if (input.previousDraft && input.rewritePatches?.length) {
    parts.push(`## 재작성 지시 — 이전 draft 유지하되 아래 이슈 반영`)
    for (const p of input.rewritePatches) {
      parts.push(`- [${p.block}] ${p.instruction}`)
    }
    parts.push('')
    parts.push('이전 draft 의 전체 구조는 유지하되 지시된 블록만 수정하세요.')
    parts.push('')
  }

  parts.push('위 정보를 바탕으로 generate_blog 도구를 호출해 블로그 1편을 반환하세요.')
  return parts.join('\n')
}

export async function writeBlog(input: WriterInput): Promise<WriterOutput> {
  if (input.verifiedPlaces.length === 0 && input.externalReferences.length === 0) {
    throw new Error('writer: verifiedPlaces + externalReferences 둘 다 비어있음')
  }

  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const client = new Anthropic(input.apiKey ? { apiKey: input.apiKey } : {})

  const start = Date.now()
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6' as never,
    max_tokens: 4096,
    system: SYSTEM,
    tools: [{
      name: 'generate_blog',
      description: '7블록 구조 블로그 1편을 구조화 반환.',
      input_schema: TOOL_SCHEMA,
    }],
    tool_choice: { type: 'tool', name: 'generate_blog' },
    messages: [{ role: 'user', content: buildPrompt(input) }],
  })
  const latencyMs = Date.now() - start

  const toolUse = response.content.find(b => b.type === 'tool_use')
  if (!toolUse || toolUse.type !== 'tool_use') {
    throw new Error('writer: tool_use 블록이 응답에 없습니다.')
  }
  const draft = toolUse.input as {
    title: string
    summary: string
    content: string
    tags: string[]
    faqs: FAQ[]
  }

  return {
    title: draft.title,
    summary: draft.summary,
    content: draft.content,
    tags: draft.tags,
    faqs: draft.faqs,
    tokensUsed: { input: response.usage.input_tokens, output: response.usage.output_tokens },
    latencyMs,
  }
}
