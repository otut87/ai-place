import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetUser = vi.fn()
const mockRedirect = vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`) })

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
  })),
}))
vi.mock('next/navigation', () => ({
  redirect: (url: string) => mockRedirect(url),
}))

beforeEach(() => {
  mockGetUser.mockReset()
  mockRedirect.mockClear()
})

describe('getOwnerUser', () => {
  it('로그인 안 됨 → null', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const { getOwnerUser } = await import('@/lib/owner/auth')
    expect(await getOwnerUser()).toBeNull()
  })

  it('로그인 됨 → { id, email }', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u-1', email: 'a@b.com' } } })
    const { getOwnerUser } = await import('@/lib/owner/auth')
    const r = await getOwnerUser()
    expect(r).toEqual({ id: 'u-1', email: 'a@b.com' })
  })

  it('email 없는 계정도 허용', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u-1' } } })
    const { getOwnerUser } = await import('@/lib/owner/auth')
    const r = await getOwnerUser()
    expect(r).toEqual({ id: 'u-1', email: null })
  })
})

describe('requireOwnerUser', () => {
  it('미인증 → /login?next=/owner 로 redirect (owner 전용 로그인, AUDIT C-2)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const { requireOwnerUser } = await import('@/lib/owner/auth')
    await expect(requireOwnerUser()).rejects.toThrow(/REDIRECT:\/login\?next=/)
  })

  it('nextPath 커스텀 → /login?next=<encoded> 로 redirect', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const { requireOwnerUser } = await import('@/lib/owner/auth')
    await expect(requireOwnerUser('/owner/places/new')).rejects.toThrow(
      /REDIRECT:\/login\?next=%2Fowner%2Fplaces%2Fnew/,
    )
  })

  it('인증 됨 → user 반환', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u', email: 'x@y.com' } } })
    const { requireOwnerUser } = await import('@/lib/owner/auth')
    const r = await requireOwnerUser()
    expect(r.id).toBe('u')
    expect(mockRedirect).not.toHaveBeenCalled()
  })
})

describe('requireOwnerForAction', () => {
  it('미인증 → UNAUTHORIZED throw', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const { requireOwnerForAction } = await import('@/lib/owner/auth')
    await expect(requireOwnerForAction()).rejects.toThrow('UNAUTHORIZED')
  })

  it('인증 됨 → user 반환', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u', email: 'x@y.com' } } })
    const { requireOwnerForAction } = await import('@/lib/owner/auth')
    const r = await requireOwnerForAction()
    expect(r.email).toBe('x@y.com')
  })
})
