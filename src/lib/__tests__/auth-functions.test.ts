/**
 * auth.ts 함수 단위 테스트
 * Supabase + Next.js redirect를 mock하여 로직 검증.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Supabase server client
const mockGetUser = vi.fn()
const mockSignIn = vi.fn()
const mockSignOut = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: mockGetUser,
      signInWithPassword: mockSignIn,
      signOut: mockSignOut,
    },
  })),
}))

// Mock Next.js redirect — throws NEXT_REDIRECT like the real one
const mockRedirect = vi.fn(() => {
  throw new Error('NEXT_REDIRECT')
})
vi.mock('next/navigation', () => ({
  redirect: mockRedirect,
}))

beforeEach(() => {
  vi.clearAllMocks()
})

// ===== getUser =====
describe('getUser', () => {
  it('인증된 유저 반환', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: '1', email: 'test@test.com' } } })

    const { getUser } = await import('@/lib/auth')
    const user = await getUser()

    expect(user).toEqual({ id: '1', email: 'test@test.com' })
  })

  it('미인증 시 null 반환', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const { getUser } = await import('@/lib/auth')
    const user = await getUser()

    expect(user).toBeNull()
  })
})

// ===== requireAuth =====
describe('requireAuth', () => {
  it('인증된 유저 반환 (리다이렉트 없음)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: '1', email: 'methoddesign7@gmail.com' } } })

    const { requireAuth } = await import('@/lib/auth')
    const user = await requireAuth()

    expect(user).toEqual({ id: '1', email: 'methoddesign7@gmail.com' })
    expect(mockRedirect).not.toHaveBeenCalled()
  })

  it('미인증 시 /admin/login으로 리다이렉트', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const { requireAuth } = await import('@/lib/auth')

    await expect(requireAuth()).rejects.toThrow('NEXT_REDIRECT')
    expect(mockRedirect).toHaveBeenCalledWith('/admin/login')
  })
})

// signIn/signOut는 auth.ts에서 제거됨 — 클라이언트 SDK에서 직접 처리
