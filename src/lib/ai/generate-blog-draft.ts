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

// postType 별 구조 지시 — 같은 7블록이라도 섹션별 길이·초점을 다르게.
// writer.ts 의 buildPostTypeStructure 와 철학 동일 (공개 pipeline + draft 양쪽 일관성).
function buildPostTypeStructure(input: GenerateBlogDraftInput): string[] {
  const hero = input.candidatePlaces[0]?.name ?? '첫 번째 업체'
  const others = input.candidatePlaces.slice(1).map(p => p.name).join(', ') || '나머지 업체'
  switch (input.postType) {
    case 'detail':
      return [
        '## 구조 지시 (postType=detail — 1곳 주인공 심층)',
        `- **주인공**: ${hero} 를 "### ${hero}" 블록에서 **600자 이상** 심층 서술 (강점·서비스 상세·추천 대상·리뷰 하이라이트).`,
        `- **보조**: ${others} 는 각각 150자 내 짧게 "참고" 톤으로만 언급.`,
        '- **비교표**: 행 3개 (주인공 1곳 강조 + 나머지 2곳 축약).',
        '- **FAQ**: 주인공 업체 관점 질문 (예약·소요시간·주차) 중심.',
      ]
    case 'compare':
      return [
        '## 구조 지시 (postType=compare — 3곳 동등 비교)',
        '- **업체별 상세**: 각 업체 200자 내 **균등**. 한 곳을 띄우지 말 것.',
        '- **비교표**: 필수 **6열+** — 가격대 / 영업시간 / 접근성 / 주요 서비스 / 전문의·자격 / 강점 한 줄.',
        '- **결론**: "목적별 추천" 형식 — "~이 목적이면 A, ~이면 B, ~이면 C".',
        '- **FAQ**: "어느 곳이 가성비?" / "야간 진료?" 같은 **비교형 질문** 중심.',
      ]
    case 'guide':
      return [
        '## 구조 지시 (postType=guide — 첫 방문자 선택 가이드)',
        '- **체크리스트**: 10개+ 항목으로 확장 — 방문 전 / 상담 중 / 결제 전 / 재방문 전 단계별.',
        '- **위험 신호**: 6개+ — 피해야 할 업체 특징 (부작용 미고지·과장 광고·가격 비공개 등).',
        '- **업체별 상세**: 각 150자 내 — "이럴 땐 여기" 포지셔닝 위주로 초보자가 빠르게 판단 가능하게.',
        '- **FAQ**: "처음 방문 비용은?" / "상담만 받아도 되나?" 같은 **첫 방문자 관점**.',
      ]
    case 'keyword':
      return [
        '## 구조 지시 (postType=keyword — 검색 랜딩 / AI 답변 최적화)',
        '- **결론**: Direct Answer Block **120자+** 로 확장. 바로 뒤 번호 매김 리스트 3개로 핵심 반복.',
        '- **업체별 상세**: 평균 250자 — 타깃 키워드 포함 자연 문장.',
        '- **FAQ**: **5개** 이상 — 롱테일 검색어 변형 커버 ("~ 비용", "~ 추천", "~ 야간", "~ 후기", "~ 잘하는 곳").',
        '- **위험 신호**: 4개 내로 축약 (체크리스트보다 실용 질문 강조).',
      ]
    case 'general':
    default:
      return []
  }
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
  const structureLines = buildPostTypeStructure(input)

  return `**도시**: ${input.cityName} (${input.city})
**업종**: ${input.categoryName} (${input.category})
**섹터**: ${input.sector}
**글 유형**: ${input.postType} — ${postTypeDescription}

**선정 근거** (T-130 자동 선정):
${input.selectionReasoning}

**후보 업체 (${input.candidatePlaces.length}곳)**:

${placesText}

${structureLines.length > 0 ? structureLines.join('\n') + '\n\n' : ''}위 데이터로 7블록 한국어 블로그 초안을 작성하세요. 도구 generate_blog_draft 호출 필수.`
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
