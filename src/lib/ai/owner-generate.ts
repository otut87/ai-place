// T-155/T-156/T-157 — Owner 자동 입력·수정용 AI 생성.
// Rate limit: 업체당 30일 rolling 5회 + 주 1회 cooldown.
// T-218: 기존 "달력 월(1일~말일)" 기준을 "지난 30일 rolling" 으로 변경 (결제일 기준 30일 과금 모델과 정렬).
// 비용 통제: $0.075/업체/30일 이하.

import Anthropic from '@anthropic-ai/sdk'
import { getAdminClient } from '@/lib/supabase/admin-client'

const MODEL = 'claude-sonnet-4-5-20250929'
const MAX_TOKENS = 3000
const MONTHLY_LIMIT = 5
const WEEKLY_MS = 7 * 24 * 60 * 60 * 1000
const ROLLING_WINDOW_MS = 30 * 24 * 60 * 60 * 1000

export interface OwnerAiInput {
  placeId?: string                  // 신규 등록 시엔 없음 (업체 생성 전 프리뷰 용도)
  name: string
  city: string                       // slug or 이름
  category: string
  cityName?: string
  categoryName?: string
  websiteUrl?: string
  instruction?: string               // 수정 시 사용자 지시
  existingFields?: Partial<OwnerAiOutput>   // T-156 수정 모드
}

export interface OwnerAiOutput {
  description: string
  tags: string[]
  services: Array<{ name: string; description?: string; priceRange?: string }>
  recommendedFor: string[]
  strengths: string[]
}

export type OwnerAiOutcome =
  | { success: true; output: OwnerAiOutput; usage: { input: number; output: number } }
  | { success: false; error: string }

export interface RateLimitStatus {
  allowed: boolean
  monthlyUsed: number
  monthlyLimit: number
  nextAllowedAt: string | null       // 주간 대기 중일 때
  remainingHours: number
  reason?: 'weekly' | 'monthly'
}

/** 업체의 AI 사용 현황 조회 (T-157). */
export async function checkAiRateLimit(placeId: string): Promise<RateLimitStatus> {
  const admin = getAdminClient()
  if (!admin) return { allowed: false, monthlyUsed: 0, monthlyLimit: MONTHLY_LIMIT, nextAllowedAt: null, remainingHours: 0 }

  const now = new Date()
  // T-218: 달력 월 → 지난 30일 rolling 으로 변경.
  const windowStart = new Date(now.getTime() - ROLLING_WINDOW_MS).toISOString()

  const { data: rows } = await admin
    .from('ai_generations')
    .select('created_at')
    .eq('place_id', placeId)
    .eq('stage', 'owner_draft')
    .gte('created_at', windowStart)
    .order('created_at', { ascending: false })

  const list = (rows ?? []) as Array<{ created_at: string }>
  const monthlyUsed = list.length

  // 월간 상한
  if (monthlyUsed >= MONTHLY_LIMIT) {
    return { allowed: false, monthlyUsed, monthlyLimit: MONTHLY_LIMIT, nextAllowedAt: null, remainingHours: 0, reason: 'monthly' }
  }

  // 주간 상한
  if (list.length > 0) {
    const lastMs = new Date(list[0].created_at).getTime()
    const nextMs = lastMs + WEEKLY_MS
    if (Date.now() < nextMs) {
      return {
        allowed: false,
        monthlyUsed,
        monthlyLimit: MONTHLY_LIMIT,
        nextAllowedAt: new Date(nextMs).toISOString(),
        remainingHours: Math.ceil((nextMs - Date.now()) / (60 * 60 * 1000)),
        reason: 'weekly',
      }
    }
  }
  return { allowed: true, monthlyUsed, monthlyLimit: MONTHLY_LIMIT, nextAllowedAt: null, remainingHours: 0 }
}

function buildPrompt(input: OwnerAiInput): string {
  const cityLabel = input.cityName ?? input.city
  const categoryLabel = input.categoryName ?? input.category
  const intro = input.existingFields
    ? '아래 기존 초안을 사용자 지시에 따라 개선해 주세요.'
    : `${cityLabel}의 ${categoryLabel} 업체 "${input.name}"에 대한 상세 정보를 작성해 주세요.`

  const existingBlock = input.existingFields
    ? `\n\n## 기존 초안\n${JSON.stringify(input.existingFields, null, 2)}\n\n## 사용자 지시\n${input.instruction ?? '전반적 품질 개선'}`
    : ''

  const websiteBlock = input.websiteUrl
    ? `\n\n## 참고 URL\n${input.websiteUrl}\n(위 URL이 접근 가능하면 내용 참조, 아니면 일반 지식 기반으로 작성)`
    : ''

  return `${intro}

출력 형식: JSON 한 개. 다음 5개 필드.
- description: 2~3 문단, 300~500자. 업종 전문성·위치·영업시간·주요 서비스 포함.
- tags: 문자열 배열 5~10개. 검색어 형태.
- services: { name, description, priceRange } 배열 3~6개.
- recommendedFor: 문자열 배열 3~5개. "직장인", "가족" 등.
- strengths: 문자열 배열 3~5개. 차별점.

규칙:
- 거짓 주장 금지. "최고의", "유일한" 같은 과장 표현 금지.
- 의료·법률 카테고리는 광고법 주의 (약효 보장·가격 과장 금지).
- 실제로 확인 가능한 사실만 기재.
- 응답은 JSON 객체 하나만 (설명 없이).
${existingBlock}${websiteBlock}`
}

/** 생성 실행. Rate limit 체크는 호출자 책임 (placeId 가 있을 때만). */
export async function generateOwnerDraft(input: OwnerAiInput): Promise<OwnerAiOutcome> {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return { success: false, error: 'ANTHROPIC_API_KEY 미설정' }

  const client = new Anthropic({ apiKey: key })
  const startMs = Date.now()
  let response
  try {
    response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      messages: [{ role: 'user', content: buildPrompt(input) }],
    })
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'AI 호출 실패' }
  }

  const textBlock = response.content.find(b => b.type === 'text')
  const raw = textBlock && 'text' in textBlock ? textBlock.text : ''
  if (!raw) return { success: false, error: 'AI 응답 비어있음' }

  // JSON 블록 추출 (```json 래핑 허용)
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return { success: false, error: 'AI 응답에서 JSON 파싱 실패' }

  let parsed: unknown
  try {
    parsed = JSON.parse(jsonMatch[0])
  } catch {
    return { success: false, error: 'JSON 파싱 실패' }
  }

  const p = parsed as Partial<OwnerAiOutput>
  const output: OwnerAiOutput = {
    description: typeof p.description === 'string' ? p.description : '',
    tags: Array.isArray(p.tags) ? p.tags.filter(x => typeof x === 'string') : [],
    services: Array.isArray(p.services) ? p.services as OwnerAiOutput['services'] : [],
    recommendedFor: Array.isArray(p.recommendedFor) ? p.recommendedFor.filter(x => typeof x === 'string') : [],
    strengths: Array.isArray(p.strengths) ? p.strengths.filter(x => typeof x === 'string') : [],
  }

  // 환각 가드 (T-158): 과장 표현 감지
  const badPatterns = /(최고의|최저의|유일한|100% 보장|절대)/
  if (badPatterns.test(output.description)) {
    return { success: false, error: '생성 결과에 과장 표현 포함 — 재시도 권장' }
  }

  // ai_generations 로깅
  if (input.placeId) {
    const admin = getAdminClient()
    if (admin) {
      await admin.from('ai_generations').insert({
        place_id: input.placeId,
        stage: 'owner_draft',
        model: MODEL,
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
        latency_ms: Date.now() - startMs,
      })
    }
  }

  return { success: true, output, usage: { input: response.usage.input_tokens, output: response.usage.output_tokens } }
}
