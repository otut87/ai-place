// Haiku LLM 기반 카테고리 분류 (T-015 Tier 3)
// Tier 1 (Kakao) + Tier 2 (Google) 에서 매칭 실패 시 호출.
// 비용 최소화: Haiku 4.5, max 200 tokens.

import Anthropic from '@anthropic-ai/sdk'

export interface LlmDetectionResult {
  category: string
  confidence: number
}

/**
 * LLM 으로 카테고리 추정. 실패/키 없음 시 null.
 */
export async function detectCategoryViaLLM(args: {
  name: string
  description?: string
  categoryHints?: string[]  // kakaoCategory, naverCategory 등 원본 문자열
  availableSlugs: string[]  // 가능한 slug 목록 (getCategories)
}): Promise<LlmDetectionResult | null> {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) {
    console.warn('[llm-detector] ANTHROPIC_API_KEY 미설정')
    return null
  }

  const client = new Anthropic({ apiKey: key })
  const hints = args.categoryHints?.filter(Boolean).join(' / ') || '(없음)'

  const prompt = `다음 업체를 주어진 카테고리 slug 목록에서 하나로 분류하세요.

업체명: ${args.name}
설명: ${args.description ?? '(없음)'}
외부 카테고리 힌트: ${hints}

가능한 slug 목록 (이 중 하나만 선택):
${args.availableSlugs.join(', ')}

JSON 으로만 답하세요. 예: {"category":"dermatology","confidence":0.95}
confidence 는 0~1, 매칭 불확실 시 낮게. 목록 외 답변 금지.`

  try {
    const res = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 150,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = res.content[0]?.type === 'text' ? res.content[0].text : ''
    const jsonMatch = text.match(/\{[^}]+\}/)
    if (!jsonMatch) return null
    const parsed = JSON.parse(jsonMatch[0]) as { category?: string; confidence?: number }
    if (!parsed.category || typeof parsed.confidence !== 'number') return null
    if (!args.availableSlugs.includes(parsed.category)) return null
    return { category: parsed.category, confidence: parsed.confidence }
  } catch (err) {
    console.error('[llm-detector] 호출 실패:', err)
    return null
  }
}
