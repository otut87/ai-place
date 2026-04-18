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

  mockInsert.mockResolvedValue({ error: null })
  mockSelect.mockResolvedValue({ data: [], error: null })

  mockFrom.mockImplementation(() => ({
    insert: (rows: unknown) => mockInsert(rows),
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        order: vi.fn(() => ({ limit: vi.fn(() => mockSelect()) })),
      })),
    })),
  }))
})

describe('recordAudit', () => {
  it('정상 insert', async () => {
    const { recordAudit } = await import('@/lib/actions/audit-places')
    const r = await recordAudit({
      placeId: 'p-1',
      actorId: 'u-1',
      action: 'create',
    })
    expect(r.success).toBe(true)
    expect(mockInsert).toHaveBeenCalled()
  })

  it('admin client null → error', async () => {
    const { getAdminClient } = await import('@/lib/supabase/admin-client')
    vi.mocked(getAdminClient).mockReturnValueOnce(null)
    const { recordAudit } = await import('@/lib/actions/audit-places')
    const r = await recordAudit({ placeId: 'p', actorId: null, action: 'delete' })
    expect(r.success).toBe(false)
  })

  it('DB 에러 → success=false', async () => {
    mockInsert.mockResolvedValueOnce({ error: { message: 'x' } })
    const { recordAudit } = await import('@/lib/actions/audit-places')
    const r = await recordAudit({ placeId: 'p', actorId: null, action: 'update', field: 'name' })
    expect(r.success).toBe(false)
  })
})

describe('recordUpdateDiffs', () => {
  it('변경 없음 → insert 호출 안 함', async () => {
    const { recordUpdateDiffs } = await import('@/lib/actions/audit-places')
    const r = await recordUpdateDiffs('p-1', 'u', { name: 'A' }, { name: 'A' })
    expect(r.success).toBe(true)
    expect(r.recorded).toBe(0)
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('변경된 필드 수만큼 row 기록', async () => {
    const { recordUpdateDiffs } = await import('@/lib/actions/audit-places')
    const r = await recordUpdateDiffs(
      'p-1',
      'u',
      { name: 'A', phone: '010', description: 'old' },
      { name: 'B', phone: '010', description: 'new' },
    )
    expect(r.recorded).toBe(2)
    const rowsArg = mockInsert.mock.calls[0][0] as Array<{ field: string; action: string }>
    expect(rowsArg.map(r2 => r2.field).sort()).toEqual(['description', 'name'])
  })

  it('status 변경은 action=status 로 기록', async () => {
    const { recordUpdateDiffs } = await import('@/lib/actions/audit-places')
    await recordUpdateDiffs('p-1', null, { status: 'pending' }, { status: 'active' })
    const rowsArg = mockInsert.mock.calls[0][0] as Array<{ field: string; action: string }>
    expect(rowsArg[0].action).toBe('status')
  })

  it('admin client null → error', async () => {
    const { getAdminClient } = await import('@/lib/supabase/admin-client')
    vi.mocked(getAdminClient).mockReturnValueOnce(null)
    const { recordUpdateDiffs } = await import('@/lib/actions/audit-places')
    const r = await recordUpdateDiffs('p', null, { name: 'A' }, { name: 'B' })
    expect(r.success).toBe(false)
  })
})

describe('listAuditForPlace', () => {
  it('admin client null → []', async () => {
    const { getAdminClient } = await import('@/lib/supabase/admin-client')
    vi.mocked(getAdminClient).mockReturnValueOnce(null)
    const { listAuditForPlace } = await import('@/lib/actions/audit-places')
    const r = await listAuditForPlace('p-1')
    expect(r).toEqual([])
  })

  it('정상 조회 → row 배열', async () => {
    mockSelect.mockResolvedValueOnce({
      data: [{ id: '1', place_id: 'p-1', action: 'create', created_at: '2026-04-18T00:00:00Z' }],
      error: null,
    })
    const { listAuditForPlace } = await import('@/lib/actions/audit-places')
    const r = await listAuditForPlace('p-1')
    expect(r).toHaveLength(1)
    expect(r[0].action).toBe('create')
  })

  it('DB 에러 → []', async () => {
    mockSelect.mockResolvedValueOnce({ data: null, error: { message: 'x' } })
    const { listAuditForPlace } = await import('@/lib/actions/audit-places')
    const r = await listAuditForPlace('p-1')
    expect(r).toEqual([])
  })
})
