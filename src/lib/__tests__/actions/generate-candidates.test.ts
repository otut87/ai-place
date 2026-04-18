/**
 * actions/generate-candidates.ts 테스트 (T-052)
 * 3회 병렬 호출 fan-out + 풀 병합을 검증. Anthropic 호출은 mock.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGenerate = vi.fn()

vi.mock('@/lib/actions/register-place', async () => {
  const actual = await vi.importActual<typeof import('@/lib/actions/register-place')>('@/lib/actions/register-place')
  return {
    ...actual,
    generatePlaceContent: (...args: unknown[]) => mockGenerate(...args),
  }
})

const BASE_INPUT = {
  name: '닥터에버스',
  category: 'dermatology',
  address: '천안시 서북구 불당동',
}

function successResult(desc: string, score = 80) {
  return {
    success: true,
    data: {
      description: desc,
      services: [{ name: '여드름 레이저', description: 'PDT 병행', priceRange: '5~12만원' }],
      faqs: [{ question: '닥터에버스 주차 가능한가요?', answer: '지하 2시간 무료입니다.' }],
      tags: ['천안 피부과', '여드름'],
      qualityScore: score,
    },
  }
}

beforeEach(() => {
  mockGenerate.mockReset()
})

describe('generateContentCandidates', () => {
  it('3회 호출 기본 — 각기 다른 toneHint 전달', async () => {
    mockGenerate
      .mockResolvedValueOnce(successResult('설명 A'))
      .mockResolvedValueOnce(successResult('설명 B'))
      .mockResolvedValueOnce(successResult('설명 C'))

    const { generateContentCandidates } = await import('@/lib/actions/generate-candidates')
    const r = await generateContentCandidates(BASE_INPUT)

    expect(r.success).toBe(true)
    expect(mockGenerate).toHaveBeenCalledTimes(3)
    const callArgs = mockGenerate.mock.calls.map(c => (c[0] as { toneHint?: string }).toneHint)
    expect(new Set(callArgs).size).toBe(3) // 3종 모두 서로 다름
  })

  it('모든 후보 실패 → error 반환', async () => {
    mockGenerate.mockResolvedValue({ success: false, error: 'LLM fail' })
    const { generateContentCandidates } = await import('@/lib/actions/generate-candidates')
    const r = await generateContentCandidates(BASE_INPUT)
    expect(r.success).toBe(false)
  })

  it('일부 실패 — 성공한 후보로 풀 구성', async () => {
    mockGenerate
      .mockResolvedValueOnce(successResult('천안 불당 위치. 여드름·리프팅 피부과 전문.'))
      .mockResolvedValueOnce({ success: false, error: 'rate-limit' })
      .mockResolvedValueOnce(successResult('천안 서북구 위치. 여드름 피부과 전문.'))

    const { generateContentCandidates } = await import('@/lib/actions/generate-candidates')
    const r = await generateContentCandidates(BASE_INPUT)
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.failureCount).toBe(1)
      expect(r.data.pool.descriptions.length).toBeGreaterThan(0)
      expect(r.data.qualityScores.length).toBe(2)
    }
  })

  it('variantCount 1 — 단일 후보만 호출', async () => {
    mockGenerate.mockResolvedValueOnce(successResult('설명 A'))
    const { generateContentCandidates } = await import('@/lib/actions/generate-candidates')
    await generateContentCandidates({ ...BASE_INPUT, variantCount: 1 })
    expect(mockGenerate).toHaveBeenCalledTimes(1)
  })

  it('feedback 은 모든 호출에 전달', async () => {
    mockGenerate.mockResolvedValue(successResult('설명'))
    const { generateContentCandidates } = await import('@/lib/actions/generate-candidates')
    await generateContentCandidates({ ...BASE_INPUT, feedback: '좀 더 간결하게', variantCount: 2 })
    for (const call of mockGenerate.mock.calls) {
      expect((call[0] as { feedback?: string }).feedback).toBe('좀 더 간결하게')
    }
  })

  it('커스텀 toneHints 지정 시 그 리스트 사용', async () => {
    mockGenerate.mockResolvedValue(successResult('설명'))
    const { generateContentCandidates } = await import('@/lib/actions/generate-candidates')
    await generateContentCandidates({
      ...BASE_INPUT,
      toneHints: ['차분한', '유쾌한'],
      variantCount: 2,
    })
    const tones = mockGenerate.mock.calls.map(c => (c[0] as { toneHint?: string }).toneHint)
    expect(tones).toEqual(['차분한', '유쾌한'])
  })
})
