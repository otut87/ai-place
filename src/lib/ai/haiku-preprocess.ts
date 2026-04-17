// Haiku 전처리 (T-023)
// 네이버 블로그 30건 + 카페 20건 (~3만자) → 구조화 요약 (~2,000자)
// Tool Use + zod 로 출력 강제.
//
// 목적: Sonnet 메인 호출(T-024) 컨텍스트 크기 축소 + 실제 리뷰·질문 신호 추출.

import { z } from 'zod'
import type { BlogPost } from '@/lib/naver/blog-search'
import type { CafePost } from '@/lib/naver/cafe-search'

export const NaverSummarySchema = z.object({
  commonTreatments: z.array(z.string().max(60)).max(10).default([]),
  priceSignals: z.string().max(200).default(''),
  positiveThemes: z.array(z.string().max(80)).max(8).default([]),
  negativeThemes: z.array(z.string().max(80)).max(8).default([]),
  uniqueFeatures: z.array(z.string().max(80)).max(8).default([]),
  commonQuestions: z.array(z.string().max(100)).max(8).default([]),
})

export type NaverSummary = z.infer<typeof NaverSummarySchema>

// Tool input schema — JSON Schema draft-07 형태. Anthropic Tool Use.
const TOOL_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    commonTreatments: {
      type: 'array',
      items: { type: 'string', maxLength: 60 },
      maxItems: 10,
      description: '블로그·카페에서 반복 언급되는 시술·서비스명 (예: "여드름 레이저", "리프팅").',
    },
    priceSignals: {
      type: 'string',
      maxLength: 200,
      description: '언급된 가격대 요약 한 문장. 예: "리프팅 20-40만원대, 여드름 관리 5-8만원". 없으면 빈 문자열.',
    },
    positiveThemes: {
      type: 'array',
      items: { type: 'string', maxLength: 80 },
      maxItems: 8,
      description: '긍정 테마 (친절도, 효과, 가격, 대기시간 등).',
    },
    negativeThemes: {
      type: 'array',
      items: { type: 'string', maxLength: 80 },
      maxItems: 8,
      description: '부정 테마 (있으면 그대로, 없으면 빈 배열).',
    },
    uniqueFeatures: {
      type: 'array',
      items: { type: 'string', maxLength: 80 },
      maxItems: 8,
      description: '이 업체만의 고유 특징 (장비, 의료진, 프로그램 등).',
    },
    commonQuestions: {
      type: 'array',
      items: { type: 'string', maxLength: 100 },
      maxItems: 8,
      description: '카페에서 반복되는 질문 (실제 고객 관심사). 물음표로 끝나게.',
    },
  },
  required: [
    'commonTreatments',
    'priceSignals',
    'positiveThemes',
    'negativeThemes',
    'uniqueFeatures',
    'commonQuestions',
  ],
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s
  return s.slice(0, max - 1) + '…'
}

export function buildContext(blogs: BlogPost[], cafes: CafePost[]): string {
  const blogText = blogs
    .map((b, i) => `[블로그 ${i + 1}] ${b.title}\n${truncate(b.description, 400)}`)
    .join('\n\n')
  const cafeText = cafes
    .map((c, i) => `[카페 ${i + 1} · ${c.cafename}] ${c.title}\n${truncate(c.description, 400)}`)
    .join('\n\n')
  return [
    blogText && `=== 네이버 블로그 (${blogs.length}건) ===\n${blogText}`,
    cafeText && `=== 네이버 카페 (${cafes.length}건) ===\n${cafeText}`,
  ]
    .filter(Boolean)
    .join('\n\n')
}

export interface PreprocessTelemetry {
  inputTokens: number
  outputTokens: number
  latencyMs: number
}

export interface PreprocessResult {
  summary: NaverSummary
  telemetry: PreprocessTelemetry
}

/**
 * Haiku 로 블로그·카페 → 구조화 요약.
 * 입력 소스가 모두 비어있으면 API 호출 없이 빈 요약 + 0 토큰 반환.
 * 에러 시 throw (caller 가 결정: fallback or propagate).
 */
export async function preprocessNaverReferences(
  blogs: BlogPost[],
  cafes: CafePost[],
  opts: { businessName?: string; category?: string } = {},
): Promise<PreprocessResult> {
  const emptySummary = NaverSummarySchema.parse({})
  if (blogs.length === 0 && cafes.length === 0) {
    return {
      summary: emptySummary,
      telemetry: { inputTokens: 0, outputTokens: 0, latencyMs: 0 },
    }
  }

  const context = buildContext(blogs, cafes)
  const nameHint = opts.businessName ? `업체: ${opts.businessName}` : ''
  const catHint = opts.category ? `업종: ${opts.category}` : ''
  const hintLine = [nameHint, catHint].filter(Boolean).join(' · ')

  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const client = new Anthropic()

  const start = Date.now()
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    system:
      '당신은 한국어 리뷰/Q&A 데이터를 구조화 요약하는 분석가입니다. ' +
      'summarize_naver_references 도구를 반드시 호출하여 결과를 반환하세요. ' +
      '광고성·반복 콘텐츠는 무시하고, 실제 고객 경험·질문만 추려냅니다.',
    tools: [
      {
        name: 'summarize_naver_references',
        description: '네이버 블로그·카페 본문에서 시술·가격·긍정/부정 테마·질문을 구조화합니다.',
        input_schema: TOOL_INPUT_SCHEMA,
      },
    ],
    tool_choice: { type: 'tool', name: 'summarize_naver_references' },
    messages: [
      {
        role: 'user',
        content: `${hintLine ? hintLine + '\n\n' : ''}${context}`,
      },
    ],
  })
  const latencyMs = Date.now() - start

  const toolUse = response.content.find(b => b.type === 'tool_use')
  if (!toolUse || toolUse.type !== 'tool_use') {
    throw new Error('Haiku 전처리: tool_use 블록이 응답에 없습니다.')
  }
  const parsed = NaverSummarySchema.parse(toolUse.input)

  return {
    summary: parsed,
    telemetry: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      latencyMs,
    },
  }
}
