// T-259 — /check 저장 URL sanitize 검증.
// query/fragment/auth 정보가 DB 에 누적되면 사용자에게 약속한 익명성 깨짐.
// Codex consult #6 후속.

import { describe, it, expect } from 'vitest'
import { sanitizeDiagnosticUrl } from '@/lib/diagnostic/history'

describe('sanitizeDiagnosticUrl', () => {
  it('단순 URL — origin + pathname 유지', () => {
    expect(sanitizeDiagnosticUrl('https://example.com/about')).toBe('https://example.com/about')
    expect(sanitizeDiagnosticUrl('http://localhost:3000/owner')).toBe('http://localhost:3000/owner')
  })

  it('query string 제거 (token, email, 내부 식별자 누출 차단)', () => {
    expect(sanitizeDiagnosticUrl('https://example.com/path?token=secret123')).toBe('https://example.com/path')
    expect(sanitizeDiagnosticUrl('https://example.com/?email=foo@bar.com&utm=x')).toBe('https://example.com/')
    expect(sanitizeDiagnosticUrl('https://api.example.com/v1?api_key=AKIA...')).toBe('https://api.example.com/v1')
  })

  it('fragment 제거', () => {
    expect(sanitizeDiagnosticUrl('https://example.com/page#section')).toBe('https://example.com/page')
    expect(sanitizeDiagnosticUrl('https://example.com/#access_token=eyJxxx')).toBe('https://example.com/')
  })

  it('query + fragment 동시 제거', () => {
    expect(sanitizeDiagnosticUrl('https://x.io/a?q=1&t=2#frag')).toBe('https://x.io/a')
  })

  it('basic auth credentials 제거 — URL parser 가 user:pass 분리', () => {
    // new URL("https://user:pass@example.com/x") → user/pass 는 .username/.password 로 분리됨.
    // .origin 은 'https://example.com', .pathname 은 '/x'. credentials 자동 제거.
    expect(sanitizeDiagnosticUrl('https://user:pass@example.com/x')).toBe('https://example.com/x')
  })

  it('parse 실패 시 null (저장 skip 보장)', () => {
    expect(sanitizeDiagnosticUrl('not a url')).toBeNull()
    expect(sanitizeDiagnosticUrl('')).toBeNull()
    expect(sanitizeDiagnosticUrl('javascript:alert(1)')).not.toBeNull() // URL parses but harmless after pathname extract
  })

  it('non-http 프로토콜 — parse 는 되지만 origin null/path 만 남음', () => {
    // file:// 는 origin='null'. 저장돼도 PII 없음.
    const r = sanitizeDiagnosticUrl('file:///etc/passwd')
    expect(r).toBeTruthy()
    // 단, 별도 protocol whitelist 검증은 scanSite 단계에서 SSRF 가드로 처리.
  })

  it('한국어/유니코드 path — 그대로 보존', () => {
    expect(sanitizeDiagnosticUrl('https://example.com/소개?utm=x')).toBe('https://example.com/%EC%86%8C%EA%B0%9C')
  })
})
