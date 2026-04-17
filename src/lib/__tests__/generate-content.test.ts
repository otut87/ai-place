/**
 * generatePlaceContent 단위 테스트 (T-024/T-025/T-027)
 * Tool Use + 품질 스코어 재생성 루프.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({
  requireAuth: vi.fn(() => ({ id: 'user-123' })),
}))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(() => ({
    from: vi.fn(() => ({ insert: vi.fn() })),
  })),
}))
vi.mock('@/lib/google-places', () => ({
  searchPlaceByText: vi.fn(),
  getPlaceDetails: vi.fn(),
}))
vi.mock('@/lib/naver-kakao-search', () => ({
  searchKakaoPlace: vi.fn(),
}))
vi.mock('@/lib/ai/telemetry', () => ({
  logAIGeneration: vi.fn(),
}))

const mockCreate = vi.fn()
vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: mockCreate }
  },
}))

const USAGE = { input_tokens: 1000, output_tokens: 500 }

const HIGH_QUALITY_PAYLOAD = {
  description: '천안시 서북구 불당동 위치. 여드름·리프팅·스킨부스터 특화 피부과 전문.',
  services: [
    { name: '여드름 레이저', description: 'PDT 3~6회 코스.', priceRange: '5~12만원' },
    { name: '리프팅', description: '인모드 1회 35분.', priceRange: '25~55만원' },
    { name: '스킨부스터', description: '리쥬란 4주 간격 3회.', priceRange: '18~35만원' },
  ],
  faqs: [
    { question: '닥터에버스 주차 가능한가요?', answer: '지하 주차 2시간 무료.' },
    { question: '닥터에버스 야간 진료 되나요?', answer: '화·목 20시까지 진료.' },
    { question: '닥터에버스 리프팅 가격?', answer: '25~55만원대입니다.' },
    { question: '여드름 몇 회 필요?', answer: '3~6회 코스 권장.' },
    { question: '초진 상담료 있나요?', answer: '없습니다.' },
  ],
  tags: ['천안 피부과', '불당 피부과', '여드름 레이저', '리프팅', '인모드'],
}

const LOW_QUALITY_PAYLOAD = {
  description: '짧은설명',
  services: [
    { name: 'A', description: 'x', priceRange: '' },
    { name: 'B', description: 'x', priceRange: '' },
    { name: 'C', description: 'x', priceRange: '' },
  ],
  faqs: [
    { question: '예약?', answer: '네' },
    { question: '예약?', answer: '네' },
    { question: '예약?', answer: '네' },
    { question: '예약?', answer: '네' },
    { question: '예약?', answer: '네' },
  ],
  tags: ['a', 'b', 'c', 'd', 'e'],
}

beforeEach(() => {
  vi.clearAllMocks()
})

const input = {
  name: '닥터에버스',
  category: 'dermatology',
  address: '충남 천안시 서북구 불당동 1118',
}

describe('generatePlaceContent (Tool Use)', () => {
  it('고품질 1회차 → 70+ 스코어, 재시도 없음', async () => {
    mockCreate.mockResolvedValue({
      content: [{
        type: 'tool_use', name: 'register_business_content',
        input: HIGH_QUALITY_PAYLOAD,
      }],
      usage: USAGE,
    })
    const { generatePlaceContent } = await import('@/lib/actions/register-place')
    const result = await generatePlaceContent(input)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.qualityScore).toBeGreaterThanOrEqual(70)
    }
    expect(mockCreate).toHaveBeenCalledTimes(1)
  })

  it('저품질 → 3회 재시도 후 마지막 결과 반환', async () => {
    mockCreate.mockResolvedValue({
      content: [{
        type: 'tool_use', name: 'register_business_content',
        input: LOW_QUALITY_PAYLOAD,
      }],
      usage: USAGE,
    })
    const { generatePlaceContent } = await import('@/lib/actions/register-place')
    const result = await generatePlaceContent(input)
    expect(mockCreate).toHaveBeenCalledTimes(3)
    // 3번 모두 저품질이어도 마지막 데이터 반환
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.qualityScore).toBeLessThan(70)
    }
  })

  it('1차 저품질 → 2차 고품질이면 2회 호출 후 중단', async () => {
    mockCreate
      .mockResolvedValueOnce({
        content: [{ type: 'tool_use', name: 'register_business_content', input: LOW_QUALITY_PAYLOAD }],
        usage: USAGE,
      })
      .mockResolvedValueOnce({
        content: [{ type: 'tool_use', name: 'register_business_content', input: HIGH_QUALITY_PAYLOAD }],
        usage: USAGE,
      })
    const { generatePlaceContent } = await import('@/lib/actions/register-place')
    const result = await generatePlaceContent(input)
    expect(mockCreate).toHaveBeenCalledTimes(2)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.qualityScore).toBeGreaterThanOrEqual(70)
    }
  })

  it('tool_use 블록 없으면 재시도, 모두 실패 시 error', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'nope' }],
      usage: USAGE,
    })
    const { generatePlaceContent } = await import('@/lib/actions/register-place')
    const result = await generatePlaceContent(input)
    expect(result.success).toBe(false)
    expect(mockCreate).toHaveBeenCalledTimes(3)
  })

  it('모델은 sonnet-4-6 + Tool Use 구조', async () => {
    mockCreate.mockResolvedValue({
      content: [{
        type: 'tool_use', name: 'register_business_content',
        input: HIGH_QUALITY_PAYLOAD,
      }],
      usage: USAGE,
    })
    const { generatePlaceContent } = await import('@/lib/actions/register-place')
    await generatePlaceContent(input)
    const call = mockCreate.mock.calls[0][0]
    expect(call.model).toBe('claude-sonnet-4-6')
    expect(call.tool_choice).toEqual({ type: 'tool', name: 'register_business_content' })
    expect(call.tools[0].name).toBe('register_business_content')
  })

  it('exemplar 블록이 프롬프트에 포함됨 (dermatology → 닥터에버스 예시)', async () => {
    mockCreate.mockResolvedValue({
      content: [{
        type: 'tool_use', name: 'register_business_content',
        input: HIGH_QUALITY_PAYLOAD,
      }],
      usage: USAGE,
    })
    const { generatePlaceContent } = await import('@/lib/actions/register-place')
    await generatePlaceContent(input)
    const content = mockCreate.mock.calls[0][0].messages[0].content
    expect(content).toContain('<exemplars>')
    expect(content).toContain('닥터에버스') // dermatology exemplar
  })

  it('naverSummary 주입 시 프롬프트에 포함', async () => {
    mockCreate.mockResolvedValue({
      content: [{
        type: 'tool_use', name: 'register_business_content',
        input: HIGH_QUALITY_PAYLOAD,
      }],
      usage: USAGE,
    })
    const { generatePlaceContent } = await import('@/lib/actions/register-place')
    await generatePlaceContent({
      ...input,
      naverSummary: {
        commonTreatments: ['여드름 레이저'],
        priceSignals: '리프팅 25-55만원대',
        positiveThemes: ['친절'], negativeThemes: [],
        uniqueFeatures: ['야간 진료'], commonQuestions: ['가격?'],
      },
    })
    const content = mockCreate.mock.calls[0][0].messages[0].content
    expect(content).toContain('네이버 블로그·카페')
    expect(content).toContain('리프팅 25-55만원대')
    expect(content).toContain('야간 진료')
  })

  it('Princeton GEO 시스템 프롬프트 반영', async () => {
    mockCreate.mockResolvedValue({
      content: [{
        type: 'tool_use', name: 'register_business_content',
        input: HIGH_QUALITY_PAYLOAD,
      }],
      usage: USAGE,
    })
    const { generatePlaceContent } = await import('@/lib/actions/register-place')
    await generatePlaceContent(input)
    const system = mockCreate.mock.calls[0][0].system
    expect(system).toContain('Statistics Addition')
    expect(system).toContain('Cite Sources')
  })

  it('각 호출마다 텔레메트리 기록', async () => {
    mockCreate.mockResolvedValue({
      content: [{
        type: 'tool_use', name: 'register_business_content',
        input: LOW_QUALITY_PAYLOAD,
      }],
      usage: USAGE,
    })
    const tel = await import('@/lib/ai/telemetry')
    const { generatePlaceContent } = await import('@/lib/actions/register-place')
    await generatePlaceContent(input)
    expect(tel.logAIGeneration).toHaveBeenCalledTimes(3) // 3회 재시도
    const firstCall = vi.mocked(tel.logAIGeneration).mock.calls[0][0]
    expect(firstCall.stage).toBe('content')
    expect(firstCall.model).toBe('claude-sonnet-4-6')
    expect(firstCall.inputTokens).toBe(USAGE.input_tokens)
  })
})
