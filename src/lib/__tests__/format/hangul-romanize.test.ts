// T-217 — 한글 로마자 변환 테스트.

import { describe, it, expect } from 'vitest'
import { romanizeKorean, suggestEnglishName } from '@/lib/format/hangul-romanize'

describe('romanizeKorean', () => {
  it('빈 입력', () => {
    expect(romanizeKorean('')).toBe('')
  })

  it('기본 음절: 가 → ga, 나 → na', () => {
    expect(romanizeKorean('가')).toBe('ga')
    expect(romanizeKorean('나')).toBe('na')
  })

  it('받침 있는 음절: 각 → gak, 안 → an', () => {
    expect(romanizeKorean('각')).toBe('gak')
    expect(romanizeKorean('안')).toBe('an')
  })

  it('업체명: 클린휴', () => {
    const out = romanizeKorean('클린휴')
    expect(out.length).toBeGreaterThan(0)
    expect(/^[a-z]+$/.test(out)).toBe(true)
  })

  it('영문 섞인 입력은 영문 유지', () => {
    const out = romanizeKorean('ABC 가')
    expect(out).toContain('ABC')
    expect(out).toContain('ga')
  })

  it('공백은 유지, 구두점은 생략', () => {
    const out = romanizeKorean('가 나')
    expect(out).toBe('ga na')
  })
})

describe('suggestEnglishName', () => {
  it('Title Case 로 변환', () => {
    const out = suggestEnglishName('클린휴 의원')
    // 각 단어 첫 글자 대문자
    const words = out.split(' ')
    for (const w of words) {
      if (w.length > 0) expect(w.charAt(0)).toBe(w.charAt(0).toUpperCase())
    }
  })

  it('빈 입력 → 빈 문자열', () => {
    expect(suggestEnglishName('')).toBe('')
  })

  it('한글 업체명 → 소문자 없이 공백 구분', () => {
    const out = suggestEnglishName('맘에든 인테리어')
    expect(out).not.toBe('')
    expect(out).toMatch(/^[A-Z][a-z]+( [A-Z][a-z]+)*$/)
  })
})
