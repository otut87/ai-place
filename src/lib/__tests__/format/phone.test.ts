// T-217 — 전화번호 자동 포매팅 테스트.

import { describe, it, expect } from 'vitest'
import { formatKoreanPhone, isValidKoreanPhone, stripNonDigits } from '@/lib/format/phone'

describe('formatKoreanPhone', () => {
  it('휴대폰 11자리: 01012345678 → 010-1234-5678', () => {
    expect(formatKoreanPhone('01012345678')).toBe('010-1234-5678')
  })

  it('서울 02 9자리: 0212345678 → 02-1234-5678', () => {
    expect(formatKoreanPhone('0212345678')).toBe('02-1234-5678')
  })

  it('서울 02 짧은 포맷: 026789012 → 02-678-9012', () => {
    expect(formatKoreanPhone('026789012')).toBe('02-678-9012')
  })

  it('지역 10자리: 0411234567 → 041-123-4567', () => {
    expect(formatKoreanPhone('0411234567')).toBe('041-123-4567')
  })

  it('지역 11자리: 04112345678 → 041-1234-5678', () => {
    expect(formatKoreanPhone('04112345678')).toBe('041-1234-5678')
  })

  it('대표번호: 15881234 → 1588-1234', () => {
    expect(formatKoreanPhone('15881234')).toBe('1588-1234')
  })

  it('070: 07012345678 → 070-1234-5678', () => {
    expect(formatKoreanPhone('07012345678')).toBe('070-1234-5678')
  })

  it('입력 중(부분): 010 → 010, 01012 → 010-12, 010123456 → 010-1234-56', () => {
    expect(formatKoreanPhone('010')).toBe('010')
    expect(formatKoreanPhone('01012')).toBe('010-12')
    expect(formatKoreanPhone('010123456')).toBe('010-123-456')
  })

  it('이미 하이픈 있는 입력 → 정규화', () => {
    expect(formatKoreanPhone('010-1234-5678')).toBe('010-1234-5678')
  })

  it('빈 문자열 → 빈 문자열', () => {
    expect(formatKoreanPhone('')).toBe('')
  })

  it('영문/특수문자 섞임 → 숫자만 추출 후 포매팅', () => {
    expect(formatKoreanPhone('tel: (010) 1234-5678')).toBe('010-1234-5678')
  })
})

describe('isValidKoreanPhone', () => {
  it('유효 번호들', () => {
    expect(isValidKoreanPhone('010-1234-5678')).toBe(true)
    expect(isValidKoreanPhone('02-1234-5678')).toBe(true)
    expect(isValidKoreanPhone('041-123-4567')).toBe(true)
    expect(isValidKoreanPhone('1588-1234')).toBe(true)
  })

  it('무효 번호들', () => {
    expect(isValidKoreanPhone('')).toBe(false)
    expect(isValidKoreanPhone('123')).toBe(false)
    expect(isValidKoreanPhone('019-abc-defg')).toBe(false)
  })
})

describe('stripNonDigits', () => {
  it('숫자만 추출', () => {
    expect(stripNonDigits('010-1234-5678')).toBe('01012345678')
    expect(stripNonDigits('(02) 1234.5678')).toBe('0212345678')
  })
})
