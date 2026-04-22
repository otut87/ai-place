// T-194 — Haiku 로 sector × angle × 25 키워드 자동 생성.
// Jaccard 0.4 이상 중복/반-중복 건 배제.
// 비용: Haiku 입력 ~2K + 출력 ~1K, 건당 ~1~2원. 12,500건 seed 시 ~14,000원 (플랜).

import { dedupeSimilar, findSimilarKeywords } from './similarity'
import { logAIGeneration } from '@/lib/ai/telemetry'

// Phase 3 `src/lib/ai/angles.ts` 에서 상세 hint 와 함께 재수출 예정.
// Phase 2 는 타입과 기본 hint 만 필요 — 두 지점이 같은 상수를 참조하도록 단일 소스화.
export type AngleKey =
  | 'review-deepdive'
  | 'price-transparency'
  | 'procedure-guide'
  | 'first-visit'
  | 'comparison-context'
  | 'seasonal'

export const ANGLE_KEYS: AngleKey[] = [
  'review-deepdive',
  'price-transparency',
  'procedure-guide',
  'first-visit',
  'comparison-context',
  'seasonal',
]

// Anthropic tool input_schema 타입은 mutable string[] 를 요구 — `as const` 금지.
const KEYWORD_SCHEMA = {
  type: 'object' as const,
  properties: {
    keywords: {
      type: 'array',
      minItems: 10,
      maxItems: 40,
      items: {
        type: 'object',
        properties: {
          keyword: {
            type: 'string',
            description: '메인 타깃 키워드 — 한국어, 3~20자, 지역+업종+의도 조합 가능',
          },
          longtails: {
            type: 'array',
            items: { type: 'string' },
            description: '2~4 개의 롱테일 변형 (예: "천안 피부과 주말진료", "여드름 모공 관리")',
          },
          priority: {
            type: 'integer',
            minimum: 1,
            maximum: 10,
            description: '1(최상)~10(최하) — 검색량·지역적합성 추정',
          },
          competition: {
            type: 'string',
            enum: ['low', 'medium', 'high'],
          },
        },
        required: ['keyword', 'longtails', 'priority', 'competition'],
        additionalProperties: false,
      },
    },
  },
  required: ['keywords'],
  additionalProperties: false,
}

export interface GeneratedKeyword {
  keyword: string
  longtails: string[]
  priority: number
  competition: 'low' | 'medium' | 'high'
}

export interface GenerateKeywordsInput {
  sector: string                   // e.g. 'medical'
  category?: string                // e.g. 'dermatology' (없으면 sector 전반)
  city?: string                    // 없으면 도시 무관 일반 키워드
  cityName?: string                // 한글 도시명 (프롬프트 자연어)
  angle: AngleKey
  count?: number                   // 기본 25
  existingKeywords?: string[]      // 기존 풀 — 유사도 체크용
  apiKey?: string                  // 테스트 override
}

export interface GenerateKeywordsResult {
  keywords: GeneratedKeyword[]
  rejected: Array<{ keyword: string; reason: string }>
  tokens: { input: number; output: number }
  latencyMs: number
}

const ANGLE_HINT: Record<AngleKey, string> = {
  'review-deepdive': '리뷰·평판·후기 중심 — "후기 많은", "리뷰 N건 분석", "평점 비교"',
  'price-transparency': '가격·비용 투명성 — "가격대", "비용 정리", "견적 비교", "보험 적용"',
  'procedure-guide': '시술/서비스 과정 가이드 — "절차", "준비물", "회복 기간", "주의사항"',
  'first-visit': '첫 방문 가이드 — "처음 방문", "초진", "예약 방법", "준비"',
  'comparison-context': '비교·대안 맥락 — "A vs B", "대안 업체", "어떤 곳이 맞을까"',
  'seasonal': '계절성/시기성 — "여름 관리", "겨울 주의", "연말 할인", "신학기"',
}

function buildPrompt(input: GenerateKeywordsInput): string {
  const citySeg = input.cityName
    ? `${input.cityName} 지역 특화 (도시명 포함 또는 지역 맥락).`
    : '도시 무관 일반 키워드 (도시명 제외).'
  const catSeg = input.category ? `세부 업종: ${input.category}` : `대분류: ${input.sector}`

  return [
    `당신은 한국 로컬 비즈니스 SEO/AEO 전문가입니다.`,
    `${catSeg}`,
    `${citySeg}`,
    `앵글: ${input.angle} — ${ANGLE_HINT[input.angle]}`,
    ``,
    `이 맥락에서 Google/AI 검색 노출 가능성 있는 타깃 키워드 ${input.count ?? 25}개를 generate_keywords 도구로 반환하세요.`,
    `원칙:`,
    `1. 실제 사람이 검색창에 칠 법한 한국어 쿼리 (3~20자).`,
    `2. 광고성/과장 표현("최고", "100%") 금지.`,
    `3. 각 키워드마다 2~4개의 롱테일 변형 필수.`,
    `4. 서로 Jaccard 유사도 높은 쌍 금지 (표현·어순 확실히 달라야 함).`,
    `5. priority 는 검색량·해당 업종 연관성 기준 추정 (1=최고).`,
  ].join('\n')
}

/**
 * Haiku 로 키워드 N개 생성 → Jaccard 기반 자체 중복 제거 + existingKeywords 대비 유사 배제.
 * 실패하거나 출력 적으면 빈 배열 반환 (상위에서 재시도 결정).
 */
export async function generateKeywordsForSector(
  input: GenerateKeywordsInput,
): Promise<GenerateKeywordsResult> {
  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const client = new Anthropic(input.apiKey ? { apiKey: input.apiKey } : {})

  // max_tokens 산정 — 한국어 키워드 25개 + longtails 3~4개 × 25 = 대략 2,500~3,500 tokens.
  // 여유롭게 6144 로 설정 (Haiku 상한 64k 기준 충분히 낮음).
  const start = Date.now()
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 6144,
    system: '당신은 한국어 로컬 SEO/AEO 키워드 리서치 전문가입니다. 반드시 generate_keywords 도구를 호출해 결과를 반환하세요.',
    tools: [{
      name: 'generate_keywords',
      description: 'sector × angle 에 맞는 타깃 키워드 N개 생성.',
      input_schema: KEYWORD_SCHEMA,
    }],
    tool_choice: { type: 'tool', name: 'generate_keywords' },
    messages: [{ role: 'user', content: buildPrompt(input) }],
  })
  const latencyMs = Date.now() - start

  const toolUse = response.content.find(b => b.type === 'tool_use')
  if (!toolUse || toolUse.type !== 'tool_use') {
    throw new Error('generateKeywordsForSector: tool_use 블록이 응답에 없습니다.')
  }
  const raw = toolUse.input as { keywords?: GeneratedKeyword[] }
  if (!raw || !Array.isArray(raw.keywords)) {
    // Haiku 가 간혹 빈 입력이나 다른 구조 반환. 빈 결과로 graceful degrade.
    console.warn('[keyword-generator] tool_use.input.keywords 가 배열이 아님:',
      JSON.stringify(raw).slice(0, 300))
    return {
      keywords: [],
      rejected: [],
      tokens: { input: response.usage.input_tokens, output: response.usage.output_tokens },
      latencyMs,
    }
  }
  const rejected: Array<{ keyword: string; reason: string }> = []

  // 1) 자체 중복 (Haiku 가 종종 비슷한 표현 반복)
  const selfDeduped = dedupeSimilar(raw.keywords.map(k => k.keyword), 0.4)
  const selfDedupedSet = new Set(selfDeduped)
  const afterSelf = raw.keywords.filter(k => {
    if (selfDedupedSet.has(k.keyword)) return true
    rejected.push({ keyword: k.keyword, reason: 'self-similar' })
    return false
  })

  // 2) existingKeywords (DB 에 이미 있는 것) 과 유사도 0.4 이상 제거
  const existing = Array.isArray(input.existingKeywords) ? input.existingKeywords : []
  const accepted: GeneratedKeyword[] = []
  for (const k of afterSelf) {
    const hits = findSimilarKeywords(k.keyword, existing, 0.4)
    if (hits.length > 0) {
      rejected.push({ keyword: k.keyword, reason: `existing-similar: ${hits[0]}` })
      continue
    }
    accepted.push(k)
  }

  // 텔레메트리
  await logAIGeneration({
    stage: 'preprocess',
    model: 'claude-haiku-4-5-20251001',
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    latencyMs,
  })

  return {
    keywords: accepted,
    rejected,
    tokens: { input: response.usage.input_tokens, output: response.usage.output_tokens },
    latencyMs,
  }
}
