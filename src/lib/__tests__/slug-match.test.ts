import { describe, it, expect } from 'vitest'
import { slugMatchCandidates, normalizeSlugForStorage } from '@/lib/slug-match'

describe('slugMatchCandidates', () => {
  it('ASCII slug 은 원본 하나만 반환', () => {
    const r = slugMatchCandidates('cheonan-dermatology-acne')
    expect(r).toEqual(['cheonan-dermatology-acne'])
  })

  it('빈 문자열은 빈 배열', () => {
    expect(slugMatchCandidates('')).toEqual([])
  })

  it('한글 NFC slug → NFC + NFD 두 후보 (원본이 NFC 라 원본==NFC)', () => {
    const nfc = '천안-웹-에이전시'.normalize('NFC')
    const r = slugMatchCandidates(nfc)
    // 원본, NFC 중복 제거. NFD 는 분해형이라 다른 문자열
    expect(r.length).toBeGreaterThanOrEqual(1)
    expect(r).toContain(nfc)
    expect(r).toContain(nfc.normalize('NFD'))
  })

  it('한글 NFD slug → NFD + NFC 두 후보', () => {
    const nfd = '천안-웹-에이전시'.normalize('NFD')
    const r = slugMatchCandidates(nfd)
    expect(r).toContain(nfd)
    expect(r).toContain(nfd.normalize('NFC'))
  })

  it('중복 정규화 후보는 Set 으로 dedup', () => {
    const ascii = 'hello-world'
    const r = slugMatchCandidates(ascii)
    // ASCII 는 NFC == NFD == 원본
    expect(r).toEqual([ascii])
  })
})

describe('normalizeSlugForStorage', () => {
  it('ASCII 는 그대로', () => {
    expect(normalizeSlugForStorage('cheonan-dental')).toBe('cheonan-dental')
  })

  it('한글은 NFC 로 통일', () => {
    const nfd = '천안-웹'.normalize('NFD')
    const nfc = '천안-웹'.normalize('NFC')
    expect(normalizeSlugForStorage(nfd)).toBe(nfc)
  })
})
