// T-129 — 블로그 초안 자동 생성 (Claude Sonnet + tool use).
// 입력: city + category + postType + candidatePlaces (T-130 결과)
// 출력: { title, summary, content, tags, faqs, qualityScore }
//
// 프롬프트 원칙:
// - 7블록 구조 강제 (T-111 validateSevenBlocks 통과)
// - Direct Answer Block 40-80자 (T-123)
// - 후보 업체만 언급, 외부 업체 환각 금지
// - 의료·법률·세무 카테고리는 면책 필수

import type { Place, FAQ, BlogPostType } from '@/lib/types'
import { validateSevenBlocks } from '@/lib/blog/template'
import { scoreBlogPostV2 } from '@/lib/blog/quality-v2'

export interface GenerateBlogDraftInput {
  city: string                      // 'cheonan'
  cityName: string                  // '천안시'
  category: string                  // 'dermatology'
  categoryName: string              // '피부과'
  sector: string                    // 'medical'
  postType: BlogPostType
  candidatePlaces: Place[]          // T-130 결과 (3~5곳)
  selectionReasoning: string        // T-130 reasoning 문자열
  apiKey?: string                   // 테스트용 override
}

export interface GenerateBlogDraftResult {
  title: string
  summary: string
  content: string
  tags: string[]
  faqs: FAQ[]
  qualityScore: number
  sevenBlockPassed: boolean
  tokensUsed: { input: number; output: number }
}

const SYSTEM_PROMPT = `당신은 AI Place 의 로컬 비즈니스 큐레이터 이지수입니다.
AI 검색(ChatGPT, Claude, Gemini) 에서 인용될 수 있도록 한국어 블로그 글을 작성합니다.

**반드시 지켜야 하는 7블록 구조** (각 블록은 H2 (## 로 시작) 로 시작):
1. ## 결론 — Direct Answer Block, 40-80자 자기완결형
2. ## 분석 방법 — 데이터 출처·기간·표본·가중치
3. ## 업체별 상세 — 각 업체를 H3 (### 이름) 로 구분, 입력된 후보만
4. ## 비교표 — HTML markdown table (| ... |) 가격·거리·전문의 등
5. ## 체크리스트 — 6~10개 bullet (방문·상담 전 확인사항)
6. ## 위험 신호 — 3~6개 bullet (피해야 할 업체 특징)
7. ## 자주 묻는 질문 — 3~5개 Q/A + 면책 문구

**엄격한 규칙**:
- 입력된 후보 업체만 언급. 없는 업체 언급 금지 (환각 금지).
- 각 업체의 rating·reviewCount·address 는 입력 데이터만 인용.
- 의료 카테고리: "치료 효과 개인차 고지" 면책 문구 필수.
- 과장 광고 표현 금지 ("최고의", "1위", "완벽한" 등).
- 가격은 "상담 문의" 로 처리 (의료광고법).
- 문체: 담백·전문가 톤. 이모지 금지.

도구 generate_blog_draft 를 반드시 호출하세요.`

const TOOL_INPUT_SCHEMA = {
  type: 'object' as const,
  required: ['title', 'summary', 'content', 'tags', 'faqs'],
  properties: {
    title: {
      type: 'string',
      description: '글 제목. "[지역] [주제] [업종] [N곳] — 리뷰 [M건] 분석 (연도)" 공식 권장, 80자 이내',
    },
    summary: {
      type: 'string',
      description: 'Direct Answer Block. 40~80자 자기완결형 한 문장. 제목 반복 금지.',
    },
    content: {
      type: 'string',
      description: '7블록 markdown. 각 블록은 ## 로 시작. 비교표는 | ... | 포맷. 면책 포함.',
    },
    tags: {
      type: 'array',
      items: { type: 'string' },
      description: '5~10개 키워드 태그 (지역·업종·시술명 등)',
    },
    faqs: {
      type: 'array',
      items: {
        type: 'object',
        required: ['question', 'answer'],
        properties: {
          question: { type: 'string' },
          answer: { type: 'string' },
        },
      },
      description: '3~5개 Q/A. FAQ 블록 본문과 중복 가능 (JSON-LD 추출용).',
    },
  },
}

function buildUserMessage(input: GenerateBlogDraftInput): string {
  const placesText = input.candidatePlaces.map((p, i) => {
    const rating = p.rating ? `${p.rating.toFixed(1)}점` : '평점 없음'
    const reviews = p.reviewCount ? `리뷰 ${p.reviewCount}건` : '리뷰 수 정보 없음'
    const addr = p.address ?? '주소 정보 없음'
    const services = (p.services ?? []).slice(0, 5).map(s => s.name).join(', ') || '서비스 정보 없음'
    const strengths = (p.strengths ?? []).join(' / ') || ''
    return [
      `### 후보 ${i + 1}: ${p.name}`,
      `- 주소: ${addr}`,
      `- 평점: ${rating}, ${reviews}`,
      `- 서비스: ${services}`,
      strengths && `- 강점: ${strengths}`,
      p.recommendationNote && `- 추천 근거: ${p.recommendationNote}`,
      `- slug: ${p.slug}`,
    ].filter(Boolean).join('\n')
  }).join('\n\n')

  const postTypeHint: Record<BlogPostType, string> = {
    detail: '특정 업체 1곳을 주인공으로 한 심층 소개 글 (강점·약점·후기 요약)',
    keyword: '특정 키워드에 최적화된 검색·답변용 랜딩 글',
    compare: '업체·시술·가격을 나란히 비교하는 글',
    guide: '처음 이용하는 독자를 위한 선택 가이드 글',
    general: '일반 추천·분석 글',
  }
  const postTypeDescription = postTypeHint[input.postType]

  return `**도시**: ${input.cityName} (${input.city})
**업종**: ${input.categoryName} (${input.category})
**섹터**: ${input.sector}
**글 유형**: ${input.postType} — ${postTypeDescription}

**선정 근거** (T-130 자동 선정):
${input.selectionReasoning}

**후보 업체 (${input.candidatePlaces.length}곳)**:

${placesText}

위 데이터로 7블록 한국어 블로그 초안을 작성하세요. 도구 generate_blog_draft 호출 필수.`
}

export async function generateBlogDraft(
  input: GenerateBlogDraftInput,
): Promise<GenerateBlogDraftResult> {
  if (input.candidatePlaces.length === 0) {
    throw new Error('후보 업체가 없습니다. T-130 selectCandidatePlaces 를 먼저 실행하세요.')
  }

  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const client = new Anthropic({ apiKey: input.apiKey })

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    tools: [
      {
        name: 'generate_blog_draft',
        description: '블로그 글 초안 (title, summary, content markdown, tags, faqs).',
        input_schema: TOOL_INPUT_SCHEMA,
      },
    ],
    tool_choice: { type: 'tool', name: 'generate_blog_draft' },
    messages: [{ role: 'user', content: buildUserMessage(input) }],
  })

  const toolUse = response.content.find(
    (c): c is Extract<typeof c, { type: 'tool_use' }> => c.type === 'tool_use',
  )
  if (!toolUse || toolUse.name !== 'generate_blog_draft') {
    throw new Error('LLM 이 generate_blog_draft tool 을 호출하지 않았습니다.')
  }
  const draft = toolUse.input as {
    title: string
    summary: string
    content: string
    tags: string[]
    faqs: Array<{ question: string; answer: string }>
  }

  // 7블록 검증 + 결정론 품질 스코어 v2 (T-193).
  // draft 단계에서는 slug 미정이므로 slug 룰은 스킵. city/allowedPlaces 는 주입.
  const sevenBlockValidation = validateSevenBlocks(draft.content, input.sector)
  const quality = scoreBlogPostV2({
    title: draft.title,
    summary: draft.summary,
    content: draft.content,
    tags: draft.tags,
    faqs: draft.faqs,
    categoryOrSector: input.sector,
    cityName: input.cityName,
    allowedPlaceNames: input.candidatePlaces.map(p => p.name),
  })

  return {
    title: draft.title,
    summary: draft.summary,
    content: draft.content,
    tags: draft.tags,
    faqs: draft.faqs,
    qualityScore: quality.score,
    sevenBlockPassed: sevenBlockValidation.passRate >= 1,
    tokensUsed: {
      input: response.usage.input_tokens,
      output: response.usage.output_tokens,
    },
  }
}
