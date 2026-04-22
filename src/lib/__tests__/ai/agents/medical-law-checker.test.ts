// T-195 — Medical/Legal/Tax compliance checker 테스트.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCreate = vi.fn()
vi.mock('@anthropic-ai/sdk', () => {
  class MockAnthropic {
    messages = { create: mockCreate }
    constructor(_opts?: unknown) {}
  }
  return { default: MockAnthropic }
})

import { checkCompliance, getDisclaimer } from '@/lib/ai/agents/medical-law-checker'

beforeEach(() => mockCreate.mockReset())

describe('checkCompliance', () => {
  it('sector 해당 없음 → applicable=false, LLM 호출 생략', async () => {
    const r = await checkCompliance({ sector: 'beauty', content: '', faqs: [], apiKey: 'k' })
    expect(r.applicable).toBe(false)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('medical sector 결정론 금칙어 탐지 (완치)', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{
        type: 'tool_use',
        name: 'compliance_check',
        input: { issues: [], disclaimerNeeded: true },
      }],
      usage: { input_tokens: 100, output_tokens: 50 },
    })

    const r = await checkCompliance({
      sector: 'medical',
      content: '본 시술은 완치를 보장합니다.',
      faqs: [],
      apiKey: 'k',
    })

    expect(r.applicable).toBe(true)
    // 결정론 필터가 "완치" 를 잡아냄
    expect(r.issues.some(i => i.phrase === '완치')).toBe(true)
    expect(r.disclaimerNeeded).toBe(true)
  })

  it('Haiku 실패해도 결정론 결과는 반환', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'no tool' }],
      usage: { input_tokens: 10, output_tokens: 10 },
    })

    const r = await checkCompliance({
      sector: 'medical',
      content: '부작용 없음을 확인했습니다.',
      faqs: [],
      apiKey: 'k',
    })

    expect(r.applicable).toBe(true)
    expect(r.issues.some(i => i.phrase === '부작용 없음')).toBe(true)
  })

  it('결정론 + Haiku 이슈 병합 (phrase 중복 제거)', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{
        type: 'tool_use',
        name: 'compliance_check',
        input: {
          issues: [
            { severity: 'fail', phrase: '완치', reason: 'Haiku 감지', suggestion: '개선 가능' },
            { severity: 'warn', phrase: '추가', reason: 'LLM 추가 감지', suggestion: '완화' },
          ],
          disclaimerNeeded: true,
        },
      }],
      usage: { input_tokens: 100, output_tokens: 50 },
    })

    const r = await checkCompliance({
      sector: 'medical',
      content: '완치가 가능한 추가 케이스.',
      faqs: [],
      apiKey: 'k',
    })

    const phrases = r.issues.map(i => i.phrase)
    // 완치 는 결정론+Haiku 모두 감지 → 한 번만
    expect(phrases.filter(p => p === '완치').length).toBe(1)
    expect(phrases).toContain('추가')
  })
})

describe('getDisclaimer', () => {
  it('medical/legal/tax 각 문구 다름', () => {
    expect(getDisclaimer('medical')).toContain('의료 진단이 아닙니다')
    expect(getDisclaimer('legal')).toContain('법률 자문이 아닙니다')
    expect(getDisclaimer('tax')).toContain('세무 자문이 아닙니다')
    expect(getDisclaimer('beauty')).toBe('')
  })
})
