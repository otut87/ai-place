import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockInsert = vi.fn()
const mockSelect = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabase/admin-client', () => ({
  getAdminClient: vi.fn(() => ({ from: mockFrom })),
}))

beforeEach(() => {
  mockInsert.mockReset()
  mockSelect.mockReset()
  mockFrom.mockReset()

  mockInsert.mockResolvedValue({ error: null, count: 1 })
  mockSelect.mockResolvedValue({ data: [], error: null })

  mockFrom.mockImplementation(() => ({
    insert: (rows: unknown, opts?: unknown) => mockInsert(rows, opts),
    select: vi.fn(() => ({
      gte: vi.fn(() => ({
        order: vi.fn(() => ({ limit: vi.fn(() => mockSelect()) })),
      })),
    })),
  }))
})

describe('insertCitations', () => {
  it('빈 입력 → 성공, insert 호출 없음', async () => {
    const { insertCitations } = await import('@/lib/actions/citations')
    const r = await insertCitations([])
    expect(r.success).toBe(true)
    expect(r.inserted).toBe(0)
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('admin null → error', async () => {
    const { getAdminClient } = await import('@/lib/supabase/admin-client')
    vi.mocked(getAdminClient).mockReturnValueOnce(null)
    const { insertCitations } = await import('@/lib/actions/citations')
    const r = await insertCitations([{
      promptId: 'p', engine: 'chatgpt', sessionId: 's-1', response: '', aiplaceCited: false,
    }])
    expect(r.success).toBe(false)
  })

  it('정상 insert — sessionId 와 text[] 페이로드 전송', async () => {
    mockInsert.mockResolvedValueOnce({ error: null, count: 2 })
    const { insertCitations } = await import('@/lib/actions/citations')
    const r = await insertCitations([
      { promptId: 'a', engine: 'chatgpt', sessionId: 'run-1', response: 'x', aiplaceCited: true, citedPlaces: ['닥터에버스'] },
      { promptId: 'b', engine: 'claude', sessionId: 'run-1', response: 'y', aiplaceCited: false },
    ])
    expect(r.success).toBe(true)
    expect(r.inserted).toBe(2)
    const payload = mockInsert.mock.calls[0][0] as Array<Record<string, unknown>>
    // 001 스키마 정합성: session_id 는 string 이어야 하고 cited_* 는 array
    expect(typeof payload[0].session_id).toBe('string')
    expect(Array.isArray(payload[0].cited_sources)).toBe(true)
    expect(Array.isArray(payload[0].cited_places)).toBe(true)
  })

  it('DB 실패 → error', async () => {
    mockInsert.mockResolvedValueOnce({ error: { message: 'x' }, count: 0 })
    const { insertCitations } = await import('@/lib/actions/citations')
    const r = await insertCitations([{ promptId: 'a', engine: 'chatgpt', sessionId: 's', response: '', aiplaceCited: false }])
    expect(r.success).toBe(false)
  })
})

describe('listRecentCitations', () => {
  it('admin null → []', async () => {
    const { getAdminClient } = await import('@/lib/supabase/admin-client')
    vi.mocked(getAdminClient).mockReturnValueOnce(null)
    const { listRecentCitations } = await import('@/lib/actions/citations')
    expect(await listRecentCitations()).toEqual([])
  })

  it('DB 에러 → []', async () => {
    mockSelect.mockResolvedValueOnce({ data: null, error: { message: 'x' } })
    const { listRecentCitations } = await import('@/lib/actions/citations')
    expect(await listRecentCitations()).toEqual([])
  })

  it('정상 반환', async () => {
    mockSelect.mockResolvedValueOnce({
      data: [
        { id: '1', prompt_id: 'a', engine: 'chatgpt', session_id: 's', response: '', cited_sources: [], cited_places: [], aiplace_cited: false, tested_at: '2026-04-10T00:00:00Z' },
      ],
      error: null,
    })
    const { listRecentCitations } = await import('@/lib/actions/citations')
    const r = await listRecentCitations(7, 100)
    expect(r).toHaveLength(1)
    expect(r[0].prompt_id).toBe('a')
    expect(r[0].session_id).toBe('s')
  })
})
