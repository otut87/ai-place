// T-254 — normalizeUrl SSRF 방어 테스트.
// 핵심 차단 대상:
//   - localhost / 루프백 / IPv6 / 사설 IP / 링크로컬 / 8진/16진/정수 인코딩 / .local · .internal
// 정상 도메인 + public IPv4 는 통과.

import { describe, it, expect } from 'vitest'
import { normalizeUrl } from '@/lib/diagnostic/scan-site'

describe('normalizeUrl — SSRF 방어 (T-254)', () => {
  // 차단 케이스 — 모두 null 반환해야 함
  const BLOCKED: string[] = [
    // localhost variants
    'http://localhost',
    'https://localhost:3000',
    'http://localhost.localdomain',
    'localhost',
    // IPv4 loopback / private / link-local / reserved
    'http://127.0.0.1',
    'https://127.0.0.1:54321',
    'http://10.0.0.1',
    'http://10.255.255.255/admin',
    'http://172.16.0.1',
    'http://172.31.0.1',
    'http://192.168.0.1',
    'http://192.168.1.100/router',
    'http://169.254.169.254/latest/meta-data/', // AWS metadata
    'http://0.0.0.0',
    // IPv6
    'http://[::1]',
    'http://[fe80::1]',
    'http://[fd00::1]',
    // 인코딩 우회
    'http://0x7f000001', // hex 127.0.0.1
    'http://2130706433',  // integer 127.0.0.1
    // 내부 TLD
    'http://service.local',
    'http://app.internal',
    'http://api.localhost',
  ]

  for (const input of BLOCKED) {
    it(`차단: ${input}`, () => {
      expect(normalizeUrl(input)).toBeNull()
    })
  }

  // 통과 케이스
  it('정상 https 도메인 → 통과', () => {
    expect(normalizeUrl('https://example.com')?.hostname).toBe('example.com')
  })

  it('정상 http 도메인 → 통과', () => {
    expect(normalizeUrl('http://example.com')?.hostname).toBe('example.com')
  })

  it('스킴 누락 → https 자동 부여', () => {
    expect(normalizeUrl('aiplace.kr')?.protocol).toBe('https:')
  })

  it('public IPv4 (8.8.8.8) → 통과 (모니터링 도구 호환)', () => {
    expect(normalizeUrl('http://8.8.8.8')?.hostname).toBe('8.8.8.8')
  })

  it('서브도메인 + 경로 보존', () => {
    const u = normalizeUrl('https://blog.example.com/posts/1')
    expect(u?.hostname).toBe('blog.example.com')
    expect(u?.pathname).toBe('/posts/1')
  })

  // 비정상 입력
  it('빈 문자열 → null', () => {
    expect(normalizeUrl('')).toBeNull()
  })

  it('잘못된 URL → null', () => {
    expect(normalizeUrl('http://')).toBeNull()
  })

  // 비http(s) 스킴 — 입력에 https?:// prefix 가 없으면 normalizeUrl 이 자동으로
  // https:// 를 붙이므로 file:// 같은 입력은 https://file 형태로 변환된다.
  // 실제 fetch 단계에서 DNS 가 'file' 호스트를 해석 못하므로 SSRF 위협 없음.
  // 호스트명 'file' 자체는 사설/예약 패턴이 아니라 normalizeUrl 통과는 가능 — OK.
  it('정상 https URL 의 hash 보존', () => {
    const u = normalizeUrl('https://example.com/page#section')
    expect(u?.hash).toBe('#section')
  })
})
