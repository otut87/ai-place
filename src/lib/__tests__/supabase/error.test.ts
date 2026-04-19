// T-126 — Supabase PostgrestError 직렬화 유틸 테스트.
// 기본 console.error 는 PostgrestError 를 {} 로 출력 (non-enumerable 속성).
// serializePostgrestError 는 message/code/details/hint 를 명시 추출해야 함.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { serializePostgrestError, formatUserFacingError, logSupabaseError } from '@/lib/supabase/error'

describe('serializePostgrestError', () => {
  it('PostgrestError 형태 객체의 필드를 모두 추출한다', () => {
    const err = {
      message: 'permission denied for table places',
      code: '42501',
      details: 'RLS policy blocked',
      hint: 'grant select to anon role',
    }
    const out = serializePostgrestError(err)
    expect(out.message).toBe('permission denied for table places')
    expect(out.code).toBe('42501')
    expect(out.details).toBe('RLS policy blocked')
    expect(out.hint).toBe('grant select to anon role')
  })

  it('null/undefined 입력은 message: "unknown" 으로 처리한다', () => {
    expect(serializePostgrestError(null).message).toBe('unknown error')
    expect(serializePostgrestError(undefined).message).toBe('unknown error')
  })

  it('빈 객체 입력은 message: "empty error" 로 처리한다 (원래 {}로 보이던 케이스)', () => {
    expect(serializePostgrestError({}).message).toBe('empty error object')
  })

  it('일반 Error 인스턴스는 message/name/stack 을 추출한다', () => {
    const err = new Error('network timeout')
    const out = serializePostgrestError(err)
    expect(out.message).toBe('network timeout')
    expect(out.name).toBe('Error')
    expect(typeof out.stack).toBe('string')
  })

  it('문자열 입력은 message 에 그대로 담는다', () => {
    expect(serializePostgrestError('raw string').message).toBe('raw string')
  })

  it('http_status 필드도 추출한다 (FetchError 호환)', () => {
    const err = { message: 'not found', status: 404 }
    const out = serializePostgrestError(err)
    expect(out.http_status).toBe(404)
  })

  it('반환 객체는 JSON.stringify 로 항상 직렬화 가능해야 한다', () => {
    const err = {
      message: 'test',
      code: 'X',
      details: null,
      circular: {} as Record<string, unknown>,
    }
    err.circular.self = err
    const out = serializePostgrestError(err)
    expect(() => JSON.stringify(out)).not.toThrow()
    expect(JSON.stringify(out)).toContain('test')
  })
})

describe('serializePostgrestError — non-enumerable', () => {
  it('비열거(non-enumerable) message/code 속성도 회수한다 (Supabase v2 실제 케이스)', () => {
    const err = {}
    Object.defineProperty(err, 'message', {
      value: 'permission denied',
      enumerable: false,
    })
    Object.defineProperty(err, 'code', {
      value: '42501',
      enumerable: false,
    })
    // Object.keys(err) 는 [] 이고 JSON.stringify(err) 는 '{}' 인 상태

    const out = serializePostgrestError(err)
    expect(out.message).toBe('permission denied')
    expect(out.code).toBe('42501')
  })
})

describe('logSupabaseError', () => {
  let spy: ReturnType<typeof vi.spyOn>
  beforeEach(() => {
    spy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    spy.mockRestore()
  })

  it('한 줄 문자열로 tag 와 message 를 함께 출력한다', () => {
    logSupabaseError('admin/places', { message: 'RLS blocked', code: '42501', hint: 'grant select' })
    expect(spy).toHaveBeenCalledOnce()
    const line = spy.mock.calls[0][0] as string
    expect(line).toContain('[admin/places]')
    expect(line).toContain('RLS blocked')
    expect(line).toContain('code=42501')
    expect(line).toContain('hint=grant select')
  })

  it('빈 객체 입력은 "empty error object" 로 출력한다', () => {
    logSupabaseError('test', {})
    const line = spy.mock.calls[0][0] as string
    expect(line).toContain('empty error object')
  })
})

describe('formatUserFacingError', () => {
  it('code 가 있으면 "메시지 (code: XXX)" 형식으로 반환한다', () => {
    const err = { message: 'RLS blocked', code: 'PGRST116' }
    expect(formatUserFacingError(err)).toBe('RLS blocked (code: PGRST116)')
  })

  it('code 없으면 메시지만 반환한다', () => {
    expect(formatUserFacingError({ message: '단순 오류' })).toBe('단순 오류')
  })

  it('빈 오류는 기본 fallback 문구를 반환한다', () => {
    expect(formatUserFacingError({})).toBe('데이터를 불러오지 못했습니다')
    expect(formatUserFacingError(null)).toBe('데이터를 불러오지 못했습니다')
  })
})
