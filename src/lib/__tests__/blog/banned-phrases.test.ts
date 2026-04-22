// T-193 — 금칙어 상수 테스트.
import { describe, it, expect } from 'vitest'
import {
  SUPERLATIVES,
  MEDICAL_FORBIDDEN,
  LEGAL_FORBIDDEN,
  TAX_FORBIDDEN,
  AI_CLICHES,
  NEGATIVE_WORDS,
  getBannedPhrasesForSector,
} from '@/lib/blog/banned-phrases'

describe('banned-phrases', () => {
  it('상수 배열이 비어있지 않다', () => {
    expect(SUPERLATIVES.length).toBeGreaterThan(0)
    expect(MEDICAL_FORBIDDEN.length).toBeGreaterThan(0)
    expect(LEGAL_FORBIDDEN.length).toBeGreaterThan(0)
    expect(TAX_FORBIDDEN.length).toBeGreaterThan(0)
    expect(AI_CLICHES.length).toBeGreaterThan(0)
    expect(NEGATIVE_WORDS.length).toBeGreaterThan(0)
  })

  it('SUPERLATIVES 는 전체 섹터에서 금지된다', () => {
    const medical = getBannedPhrasesForSector('medical')
    const legal = getBannedPhrasesForSector('legal')
    const generic = getBannedPhrasesForSector()
    for (const s of SUPERLATIVES) {
      expect(medical).toContain(s)
      expect(legal).toContain(s)
      expect(generic).toContain(s)
    }
  })

  it('medical sector 는 MEDICAL_FORBIDDEN 만 추가된다', () => {
    const medical = getBannedPhrasesForSector('medical')
    for (const m of MEDICAL_FORBIDDEN) expect(medical).toContain(m)
    for (const l of LEGAL_FORBIDDEN) expect(medical).not.toContain(l)
  })

  it('알 수 없는 섹터는 SUPERLATIVES 만 반환', () => {
    const unknown = getBannedPhrasesForSector('unknown-sector')
    expect(unknown).toEqual(SUPERLATIVES)
  })

  it('의료 금칙어에 대표 표현이 포함된다', () => {
    expect(MEDICAL_FORBIDDEN).toContain('완치')
    expect(MEDICAL_FORBIDDEN).toContain('부작용 없음')
  })
})
