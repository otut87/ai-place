// T-157/T-158 — Rate limit + 환각 가드 테스트.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFrom = vi.fn()
vi.mock('@/lib/supabase/admin-client', () => ({
  getAdminClient: () => ({ from: mockFrom }),
}))

const MS_DAY = 24 * 60 * 60 * 1000

beforeEach(() => {
  mockFrom.mockReset()
})

function mockRows(rows: Array<{ created_at: string }>) {
  mockFrom.mockImplementation(() => ({
    select: () => ({
      eq: () => ({
        eq: () => ({
          gte: () => ({
            order: () => Promise.resolve({ data: rows }),
          }),
        }),
      }),
    }),
  }))
}

describe('checkAiRateLimit', () => {
  it('이력 없음 → allowed', async () => {
    mockRows([])
    const { checkAiRateLimit } = await import('@/lib/ai/owner-generate')
    const s = await checkAiRateLimit('p1')
    expect(s.allowed).toBe(true)
    expect(s.monthlyUsed).toBe(0)
  })

  it('최근 실행 2일 전 → weekly 차단', async () => {
    mockRows([{ created_at: new Date(Date.now() - 2 * MS_DAY).toISOString() }])
    const { checkAiRateLimit } = await import('@/lib/ai/owner-generate')
    const s = await checkAiRateLimit('p1')
    expect(s.allowed).toBe(false)
    expect(s.reason).toBe('weekly')
    expect(s.remainingHours).toBeGreaterThan(0)
  })

  it('최근 8일 전 + 총 2회 → allowed', async () => {
    mockRows([
      { created_at: new Date(Date.now() - 8 * MS_DAY).toISOString() },
      { created_at: new Date(Date.now() - 20 * MS_DAY).toISOString() },
    ])
    const { checkAiRateLimit } = await import('@/lib/ai/owner-generate')
    const s = await checkAiRateLimit('p1')
    expect(s.allowed).toBe(true)
    expect(s.monthlyUsed).toBe(2)
  })

  it('이번 달 5회 사용 → monthly 차단', async () => {
    mockRows(Array.from({ length: 5 }, (_, i) => ({ created_at: new Date(Date.now() - (i + 1) * 2 * MS_DAY).toISOString() })))
    const { checkAiRateLimit } = await import('@/lib/ai/owner-generate')
    const s = await checkAiRateLimit('p1')
    expect(s.allowed).toBe(false)
    expect(s.reason).toBe('monthly')
    expect(s.monthlyUsed).toBe(5)
  })

  it('T-218: 30일 rolling — 31일 이전 이력 5개는 window 밖이라 DB 가 gte 필터로 이미 제외 → allowed', async () => {
    // DB 쿼리가 windowStart 보다 오래된 row 는 반환하지 않는다. mock 도 같은 행동 — 빈 배열 리턴.
    mockRows([])
    const { checkAiRateLimit } = await import('@/lib/ai/owner-generate')
    const s = await checkAiRateLimit('p1')
    expect(s.allowed).toBe(true)
    expect(s.monthlyUsed).toBe(0)
  })
})

// generateOwnerDraft — Anthropic SDK mock 으로 응답 파싱 / 환각 가드 / logging 분기 커버.
const mockCreate = vi.fn()
vi.mock('@anthropic-ai/sdk', () => {
  class MockAnthropic {
    messages = { create: mockCreate }
    constructor(_opts?: unknown) {}
  }
  return { default: MockAnthropic }
})

function mockAiInsert() {
  // ai_generations insert mock. generateOwnerDraft 는 insert 만 호출.
  mockFrom.mockImplementation((_table: string) => ({
    insert: vi.fn(async () => ({ error: null })),
    // rate-limit 체크 경로 — generateOwnerDraft 는 호출 안 하지만 안전 폴백.
    select: () => ({
      eq: () => ({
        eq: () => ({
          gte: () => ({ order: () => Promise.resolve({ data: [] }) }),
        }),
      }),
    }),
  }))
}

const VALID_DRAFT_JSON = JSON.stringify({
  description: '천안 서북구 소재 전문 피부과. 여드름·모공·기미 관리 진료. 평일 9시~19시 영업.',
  tags: ['천안', '피부과', '여드름'],
  services: [{ name: '여드름 치료', description: '상담 포함', priceRange: '상담 문의' }],
  recommendedFor: ['20-30대', '여드름 고민'],
  strengths: ['전문의 2인', '야간 상담'],
})

describe('generateOwnerDraft', () => {
  beforeEach(() => {
    mockCreate.mockReset()
    process.env.ANTHROPIC_API_KEY = 'sk-test'
  })

  it('API 키 없음 → 실패', async () => {
    delete process.env.ANTHROPIC_API_KEY
    const { generateOwnerDraft } = await import('@/lib/ai/owner-generate')
    const r = await generateOwnerDraft({ name: 'X', city: 'cheonan', category: 'medical' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error).toMatch(/ANTHROPIC/)
  })

  it('Anthropic throw → 실패', async () => {
    mockCreate.mockRejectedValueOnce(new Error('network'))
    const { generateOwnerDraft } = await import('@/lib/ai/owner-generate')
    const r = await generateOwnerDraft({ name: 'X', city: 'cheonan', category: 'medical' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error).toBe('network')
  })

  it('빈 응답(text block 없음) → 파싱 실패', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'tool_use', name: 'x', input: {} }],
      usage: { input_tokens: 100, output_tokens: 0 },
    })
    const { generateOwnerDraft } = await import('@/lib/ai/owner-generate')
    const r = await generateOwnerDraft({ name: 'X', city: 'cheonan', category: 'medical' })
    expect(r.success).toBe(false)
  })

  it('JSON 매치 실패 → 파싱 실패', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'no json here' }],
      usage: { input_tokens: 100, output_tokens: 10 },
    })
    const { generateOwnerDraft } = await import('@/lib/ai/owner-generate')
    const r = await generateOwnerDraft({ name: 'X', city: 'cheonan', category: 'medical' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error).toContain('JSON')
  })

  it('손상된 JSON → 파싱 실패', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '{"description": broken' }],
      usage: { input_tokens: 100, output_tokens: 10 },
    })
    const { generateOwnerDraft } = await import('@/lib/ai/owner-generate')
    const r = await generateOwnerDraft({ name: 'X', city: 'cheonan', category: 'medical' })
    expect(r.success).toBe(false)
  })

  it('환각 가드 — "최고의" 포함 시 실패', async () => {
    const badJson = JSON.stringify({
      description: '최고의 피부과. 100% 보장.',
      tags: [], services: [], recommendedFor: [], strengths: [],
    })
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: badJson }],
      usage: { input_tokens: 100, output_tokens: 50 },
    })
    const { generateOwnerDraft } = await import('@/lib/ai/owner-generate')
    const r = await generateOwnerDraft({ name: 'X', city: 'cheonan', category: 'medical' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error).toContain('과장')
  })

  it('정상 생성 → success + output + usage', async () => {
    mockAiInsert()
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: VALID_DRAFT_JSON }],
      usage: { input_tokens: 500, output_tokens: 800 },
    })
    const { generateOwnerDraft } = await import('@/lib/ai/owner-generate')
    const r = await generateOwnerDraft({
      placeId: 'p-1', name: '클린휴의원', city: 'cheonan', category: 'dermatology',
      cityName: '천안시', categoryName: '피부과',
    })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.output.tags).toContain('천안')
      expect(r.output.services).toHaveLength(1)
      expect(r.usage.input).toBe(500)
    }
  })

  it('기존 fields + instruction 있으면 수정 모드 프롬프트', async () => {
    mockAiInsert()
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: VALID_DRAFT_JSON }],
      usage: { input_tokens: 600, output_tokens: 400 },
    })
    const { generateOwnerDraft } = await import('@/lib/ai/owner-generate')
    const r = await generateOwnerDraft({
      name: '클린휴의원', city: 'cheonan', category: 'dermatology',
      existingFields: { description: '기존 소개', tags: ['피부과'] },
      instruction: '더 구체적으로',
    })
    expect(r.success).toBe(true)
    // 프롬프트에 "기존 초안" / "사용자 지시" 문구 포함됐는지 — mockCreate 호출 인자 확인
    const called = mockCreate.mock.calls[0]?.[0]
    const prompt = called.messages[0].content as string
    expect(prompt).toContain('기존 초안')
    expect(prompt).toContain('더 구체적으로')
  })

  it('websiteUrl 제공 시 프롬프트에 포함', async () => {
    mockAiInsert()
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: VALID_DRAFT_JSON }],
      usage: { input_tokens: 500, output_tokens: 400 },
    })
    const { generateOwnerDraft } = await import('@/lib/ai/owner-generate')
    await generateOwnerDraft({
      name: '클린휴의원', city: 'cheonan', category: 'dermatology',
      websiteUrl: 'https://example.com',
    })
    const prompt = mockCreate.mock.calls[0]?.[0].messages[0].content as string
    expect(prompt).toContain('https://example.com')
  })

  it('placeId 없으면 ai_generations insert 호출 안 함', async () => {
    const insertSpy = vi.fn(async () => ({ error: null }))
    mockFrom.mockImplementation(() => ({ insert: insertSpy }))
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: VALID_DRAFT_JSON }],
      usage: { input_tokens: 500, output_tokens: 400 },
    })
    const { generateOwnerDraft } = await import('@/lib/ai/owner-generate')
    const r = await generateOwnerDraft({ name: '미등록', city: 'cheonan', category: 'dermatology' })
    expect(r.success).toBe(true)
    expect(insertSpy).not.toHaveBeenCalled()
  })
})
