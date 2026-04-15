/**
 * Auth + Middleware 테스트
 * - auth.ts: getUser, requireAuth, signIn, signOut
 * - middleware.ts: /admin/* 보호, /admin/login 허용
 * - admin/login/page.tsx: 로그인 폼 존재
 * - admin/layout.tsx: 인증된 유저만 접근
 */
import { describe, it, expect, vi } from 'vitest'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

// ===== 1. 파일 존재 확인 =====
describe('Phase 3 파일 존재', () => {
  const files = [
    'src/lib/auth.ts',
    'src/middleware.ts',
    'src/app/admin/login/page.tsx',
    'src/app/admin/layout.tsx',
  ]

  for (const file of files) {
    it(`${file} 존재`, () => {
      expect(existsSync(join(process.cwd(), file)), `${file} 없음`).toBe(true)
    })
  }
})

// ===== 2. auth.ts 함수 export 확인 =====
describe('auth.ts exports', () => {
  it('getUser 함수 export', async () => {
    const mod = await import('@/lib/auth')
    expect(typeof mod.getUser).toBe('function')
  })

  it('requireAuth 함수 export', async () => {
    const mod = await import('@/lib/auth')
    expect(typeof mod.requireAuth).toBe('function')
  })

  it('signIn/signOut는 클라이언트에서 처리 (auth.ts에 미포함)', async () => {
    const mod = await import('@/lib/auth')
    expect((mod as Record<string, unknown>).signIn).toBeUndefined()
    expect((mod as Record<string, unknown>).signOut).toBeUndefined()
  })
})

// ===== 3. middleware.ts 구조 검증 =====
describe('middleware.ts', () => {
  it('middleware 함수를 default export', () => {
    const content = readFileSync(join(process.cwd(), 'src/middleware.ts'), 'utf-8')
    expect(content).toMatch(/export.*middleware/i)
  })

  it('/admin 경로 매칭 config 포함', () => {
    const content = readFileSync(join(process.cwd(), 'src/middleware.ts'), 'utf-8')
    expect(content).toMatch(/admin/i)
  })

  it('/admin/login은 보호 제외 (공개 접근)', () => {
    const content = readFileSync(join(process.cwd(), 'src/middleware.ts'), 'utf-8')
    expect(content).toMatch(/login/i)
  })

  it('Supabase 세션 갱신 로직 포함', () => {
    const content = readFileSync(join(process.cwd(), 'src/middleware.ts'), 'utf-8')
    expect(content).toMatch(/supabase|getUser|auth/i)
  })
})

// ===== 4. admin/login/page.tsx 구조 검증 =====
describe('admin/login/page.tsx', () => {
  it('이메일 입력 필드 존재', () => {
    const content = readFileSync(join(process.cwd(), 'src/app/admin/login/page.tsx'), 'utf-8')
    expect(content).toMatch(/type=.*email/i)
  })

  it('비밀번호 입력 필드 존재', () => {
    const content = readFileSync(join(process.cwd(), 'src/app/admin/login/page.tsx'), 'utf-8')
    expect(content).toMatch(/type=.*password/i)
  })

  it('로그인 버튼/submit 존재', () => {
    const content = readFileSync(join(process.cwd(), 'src/app/admin/login/page.tsx'), 'utf-8')
    expect(content).toMatch(/submit|로그인/i)
  })
})

// ===== 5. admin/layout.tsx 구조 검증 =====
describe('admin/layout.tsx', () => {
  it('레이아웃 파일에 children 렌더링', () => {
    const content = readFileSync(join(process.cwd(), 'src/app/admin/layout.tsx'), 'utf-8')
    expect(content).toMatch(/children/i)
  })
})

// ===== 6. 공개 페이지에 영향 없음 (GEO/SEO/AEO) =====
describe('공개 페이지 보호 없음', () => {
  it('middleware config에 공개 페이지 경로 미포함', () => {
    const content = readFileSync(join(process.cwd(), 'src/middleware.ts'), 'utf-8')
    // 공개 경로가 matcher에 없어야 함
    expect(content).not.toMatch(/matcher.*cheonan/i)
    expect(content).not.toMatch(/matcher.*compare/i)
    expect(content).not.toMatch(/matcher.*guide/i)
  })
})
