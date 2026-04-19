// 리뷰 요약 생성기 (Phase 11)
// 입력: 특정 소스(Google/Naver/Kakao)의 리뷰 본문 여러 건
// 출력: ReviewSummary 1건 — 긍정 테마, 부정 테마, 패러프레이즈된 샘플 인용 1건
//
// 정책:
// - 리뷰 본문을 그대로 저장하지 않는다 (저작권/ToS).
// - sampleQuote 는 반드시 "패러프레이즈" — 원문 그대로 인용 금지.
// - Google Places API ToS §5.2: 리뷰 원문 30일 초과 저장 금지. 요약은 파생 저작물로 허용.

import { z } from 'zod'
import type { ReviewSummary } from '@/lib/types'

export const ReviewSummarySchema = z.object({
  positiveThemes: z.array(z.string().max(80)).max(6).default([]),
  negativeThemes: z.array(z.string().max(80)).max(6).default([]),
  sampleQuote: z.string().max(140).optional(),
})

export type AiReviewSummaryOutput = z.infer<typeof ReviewSummarySchema>

const TOOL_SCHEMA = {
  type: 'object' as const,
  properties: {
    positiveThemes: {
      type: 'array',
      items: { type: 'string', maxLength: 80 },
      maxItems: 6,
      description: '실제 리뷰에서 반복되는 긍정 포인트. 예: "친절한 상담", "대기시간 짧음".',
    },
    negativeThemes: {
      type: 'array',
      items: { type: 'string', maxLength: 80 },
      maxItems: 6,
      description: '부정 테마. 없으면 빈 배열. 절대 지어내지 말 것.',
    },
    sampleQuote: {
      type: 'string',
      maxLength: 140,
      description: '대표적인 고객 경험을 30~80자로 **완전히 재서술(패러프레이즈)**. 원문 그대로 인용 금지. 없으면 빈 문자열.',
    },
  },
  required: ['positiveThemes', 'negativeThemes', 'sampleQuote'],
}

export interface ReviewInput {
  text: string
  rating?: number
  relativeTime?: string
}

export interface SummarizeOptions {
  businessName?: string
  category?: string
}

export interface SummarizeResult {
  summary: ReviewSummary
  inputTokens: number
  outputTokens: number
  latencyMs: number
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + '…'
}

function buildContext(reviews: ReviewInput[]): string {
  return reviews
    .map((r, i) => {
      const ratingTag = r.rating != null ? `[${r.rating}점]` : ''
      const timeTag = r.relativeTime ? `(${r.relativeTime})` : ''
      return `[리뷰 ${i + 1}] ${ratingTag}${timeTag} ${truncate(r.text, 400)}`
    })
    .join('\n\n')
}

/**
 * Claude Haiku 로 리뷰 N건 → 구조화 요약 1건.
 * 리뷰 입력 없으면 API 호출 생략.
 */
export async function summarizeReviewsForSource(
  source: string,
  reviews: ReviewInput[],
  opts: SummarizeOptions = {},
): Promise<SummarizeResult | null> {
  if (reviews.length === 0) return null

  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const client = new Anthropic()

  const nameHint = opts.businessName ? `업체: ${opts.businessName}` : ''
  const catHint = opts.category ? `업종: ${opts.category}` : ''
  const hintLine = [nameHint, catHint].filter(Boolean).join(' · ')

  const context = buildContext(reviews)

  const start = Date.now()
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: [
      '당신은 한국어 리뷰를 구조화 요약하는 분석가입니다.',
      'summarize_review 도구를 반드시 호출해 결과를 반환하세요.',
      '원칙:',
      '1. 원문 인용 금지 — sampleQuote 는 완전히 다른 표현으로 재서술.',
      '2. 광고성/반복 리뷰는 무시하고 실제 경험만 추출.',
      '3. 부정 테마를 지어내지 않는다 (데이터에 없으면 빈 배열).',
    ].join('\n'),
    tools: [{
      name: 'summarize_review',
      description: '리뷰 N건을 긍정/부정 테마와 패러프레이즈 인용 1건으로 요약.',
      input_schema: TOOL_SCHEMA,
    }],
    tool_choice: { type: 'tool', name: 'summarize_review' },
    messages: [{
      role: 'user',
      content: `${hintLine ? hintLine + '\n\n' : ''}소스: ${source}\n\n${context}`,
    }],
  })
  const latencyMs = Date.now() - start

  const toolUse = response.content.find(b => b.type === 'tool_use')
  if (!toolUse || toolUse.type !== 'tool_use') {
    throw new Error('summarizeReviewsForSource: tool_use 블록이 응답에 없습니다.')
  }
  const parsed = ReviewSummarySchema.parse(toolUse.input)

  const summary: ReviewSummary = {
    source,
    positiveThemes: parsed.positiveThemes,
    negativeThemes: parsed.negativeThemes,
    sampleQuote: parsed.sampleQuote && parsed.sampleQuote.trim().length > 0 ? parsed.sampleQuote : undefined,
    lastChecked: new Date().toISOString().slice(0, 10),
  }

  return {
    summary,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    latencyMs,
  }
}

/**
 * 기존 요약 배열에서 특정 소스를 새 요약으로 upsert.
 * 소스 매칭은 case-insensitive.
 */
export function upsertReviewSummary(
  existing: ReviewSummary[] | undefined,
  next: ReviewSummary,
): ReviewSummary[] {
  const list = existing ?? []
  const idx = list.findIndex(s => s.source.toLowerCase() === next.source.toLowerCase())
  if (idx === -1) return [...list, next]
  const copy = [...list]
  copy[idx] = next
  return copy
}

/**
 * 요약이 stale 인지 판정. lastChecked 가 maxAgeDays 일 보다 오래됐거나 없으면 true.
 */
export function isSummaryStale(
  summary: ReviewSummary | undefined,
  maxAgeDays: number,
  now: Date = new Date(),
): boolean {
  if (!summary || !summary.lastChecked) return true
  const last = new Date(summary.lastChecked + 'T00:00:00Z')
  if (Number.isNaN(last.getTime())) return true
  const ageMs = now.getTime() - last.getTime()
  const maxMs = maxAgeDays * 24 * 60 * 60 * 1000
  return ageMs > maxMs
}
