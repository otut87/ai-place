import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── 외부 dependency mock ─────────────────────────────────────────
vi.mock('@/lib/owner/auth', () => ({
  requireOwnerUser: vi.fn(async () => ({ id: 'user-1', email: 'o@test.com' })),
}))

const mockListOwnerPlaces = vi.fn()
vi.mock('@/lib/actions/owner-places', () => ({
  listOwnerPlaces: (...a: unknown[]) => mockListOwnerPlaces(...a),
}))

const mockCountMentions = vi.fn()
vi.mock('@/lib/owner/place-mentions', () => ({
  countMentionsByPlace: (ids: string[]) => mockCountMentions(ids),
}))

const mockScoreAeo = vi.fn()
vi.mock('@/lib/owner/place-aeo-score', async (importActual) => {
  const actual = await importActual<typeof import('@/lib/owner/place-aeo-score')>()
  return { ...actual, scorePlaceAeo: (args: unknown) => mockScoreAeo(args) }
})

const mockBotSummary = vi.fn()
const mockDailyTrend = vi.fn()
const mockRecentVisits = vi.fn()
vi.mock('@/lib/owner/bot-stats', () => ({
  getOwnerBotSummary: (...a: unknown[]) => mockBotSummary(...a),
  getOwnerDailyTrend: (...a: unknown[]) => mockDailyTrend(...a),
  listOwnerBotVisits: (...a: unknown[]) => mockRecentVisits(...a),
}))

const mockDetectTodos = vi.fn()
vi.mock('@/lib/owner/todos', () => ({
  detectOwnerTodos: (args: unknown) => mockDetectTodos(args),
}))

const mockGetWindow = vi.fn()
vi.mock('@/lib/owner/measurement-window', () => ({
  getMeasurementWindow: (...a: unknown[]) => mockGetWindow(...a),
}))

// ── Supabase mock — dashboard-data 가 직접 쿼리하는 3 테이블 ────────
interface DbState {
  customer: Record<string, unknown> | null
  billingKey: Record<string, unknown> | null
  places: Record<string, unknown>[]
  sectorMap: Array<{ category_slug: string; sector_slug: string }>
  placesQueryError: { message: string } | null
}

const db: DbState = {
  customer: null,
  billingKey: null,
  places: [],
  sectorMap: [],
  placesQueryError: null,
}

function makeAdmin() {
  return {
    from(table: string) {
      if (table === 'customers') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: db.customer, error: null }),
            }),
          }),
        }
      }
      if (table === 'billing_keys') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: db.billingKey, error: null }),
              }),
            }),
          }),
        }
      }
      if (table === 'places') {
        return {
          select: () => ({
            in: async () => ({
              data: db.places,
              error: db.placesQueryError,
            }),
          }),
        }
      }
      if (table === 'category_sector') {
        return {
          select: async () => ({ data: db.sectorMap, error: null }),
        }
      }
      throw new Error(`unexpected table ${table}`)
    },
  }
}

vi.mock('@/lib/supabase/admin-client', () => ({
  getAdminClient: vi.fn(() => makeAdmin()),
}))

beforeEach(() => {
  mockListOwnerPlaces.mockReset().mockResolvedValue([])
  mockCountMentions.mockReset().mockResolvedValue(new Map())
  mockScoreAeo.mockReset().mockReturnValue({
    score: 85, grade: 'A',
    rules: [
      { id: 'r1', label: 'r1', weight: 20, passed: true },
      { id: 'r2', label: 'r2', weight: 20, passed: false },
    ],
    missingTotal: 15,
  })
  mockBotSummary.mockReset().mockResolvedValue({
    periodDays: 30, since: '2026-03-22T00:00:00Z', placeIds: [],
    aiSearch: { total: 0, direct: 0, mention: 0, byEngine: {}, lastVisitAt: null },
    aiTraining: { total: 0, direct: 0, mention: 0, byEngine: {}, lastVisitAt: null },
  })
  mockDailyTrend.mockReset().mockResolvedValue([])
  mockRecentVisits.mockReset().mockResolvedValue([])
  mockDetectTodos.mockReset().mockReturnValue([])
  mockGetWindow.mockReset().mockReturnValue({ state: 'measuring', daysSinceSignup: 5 })
  db.customer = null
  db.billingKey = null
  db.places = []
  db.sectorMap = []
  db.placesQueryError = null
})

describe('loadOwnerDashboard', () => {
  it('업체 0개 → 빈 places + averageAeo null', async () => {
    const { loadOwnerDashboard } = await import('@/lib/owner/dashboard-data')
    const d = await loadOwnerDashboard(new Date('2026-04-22T00:00:00Z'))
    expect(d.places).toEqual([])
    expect(d.averageAeoScore).toBeNull()
    expect(d.trendDays).toBe(30)
    expect(d.user.id).toBe('user-1')
  })

  it('업체 있음 → AEO 계산 + 평균 점수', async () => {
    mockListOwnerPlaces.mockResolvedValueOnce([
      { id: 'p-1', slug: 's1', name: '업체1', city: 'cheonan', category: 'dermatology', status: 'active', updated_at: '2026-04-20T00:00:00Z' },
      { id: 'p-2', slug: 's2', name: '업체2', city: 'cheonan', category: 'dentistry', status: 'active', updated_at: null },
    ])
    db.places = [
      {
        id: 'p-1', slug: 's1', name: '업체1', city: 'cheonan', category: 'dermatology',
        status: 'active', description: 'd1', phone: '010', address: 'A', opening_hours: null,
        tags: null, images: null, image_url: null, rating: null, review_count: null,
        services: null, faqs: null, review_summaries: null,
        updated_at: '2026-04-20T00:00:00Z', created_at: '2026-03-01T00:00:00Z',
      },
      {
        id: 'p-2', slug: 's2', name: '업체2', city: 'cheonan', category: 'dentistry',
        status: 'active', description: null, phone: null, address: null, opening_hours: null,
        tags: null, images: null, image_url: null, rating: null, review_count: null,
        services: null, faqs: null, review_summaries: null,
        updated_at: null, created_at: '2026-03-15T00:00:00Z',
      },
    ]
    db.sectorMap = [
      { category_slug: 'dermatology', sector_slug: 'medical' },
      { category_slug: 'dentistry', sector_slug: 'medical' },
    ]
    mockScoreAeo
      .mockReturnValueOnce({
        score: 80, grade: 'B',
        rules: [{ id: 'r', label: 'r', weight: 20, passed: true }], missingTotal: 20,
      })
      .mockReturnValueOnce({
        score: 60, grade: 'C',
        rules: [{ id: 'r', label: 'r', weight: 20, passed: false }], missingTotal: 40,
      })

    const { loadOwnerDashboard } = await import('@/lib/owner/dashboard-data')
    const d = await loadOwnerDashboard(new Date('2026-04-22T00:00:00Z'))
    expect(d.places).toHaveLength(2)
    expect(d.places[0].aeoScore).toBe(80)
    expect(d.places[0].sector).toBe('medical')
    expect(d.places[1].aeoScore).toBe(60)
    expect(d.averageAeoScore).toBe(70)
  })

  it('billing.hasCard: active billing_key 존재 시 true', async () => {
    db.customer = { id: 'c-1', trial_started_at: null, trial_ends_at: null }
    db.billingKey = { id: 'bk-1' }
    const { loadOwnerDashboard } = await import('@/lib/owner/dashboard-data')
    const d = await loadOwnerDashboard()
    expect(d.billing.hasCard).toBe(true)
  })

  it('billing.hasCard: 없으면 false + pilotRemainingDays 기본 30', async () => {
    db.customer = null
    const { loadOwnerDashboard } = await import('@/lib/owner/dashboard-data')
    const d = await loadOwnerDashboard()
    expect(d.billing.hasCard).toBe(false)
    expect(d.billing.pilotRemainingDays).toBe(30)
  })

  it('trial_ends_at 있음 → 남은 일수 계산', async () => {
    const now = new Date('2026-04-22T00:00:00Z')
    const future = new Date(now.getTime() + 10 * 86_400_000).toISOString()
    db.customer = { id: 'c-1', trial_started_at: '2026-04-10T00:00:00Z', trial_ends_at: future }
    const { loadOwnerDashboard } = await import('@/lib/owner/dashboard-data')
    const d = await loadOwnerDashboard(now)
    expect(d.billing.pilotRemainingDays).toBe(10)
  })

  it('trial_started_at 있고 trial_ends_at 없음 → 30 - elapsed 로 계산', async () => {
    const now = new Date('2026-04-22T00:00:00Z')
    const started = new Date(now.getTime() - 10 * 86_400_000).toISOString()
    db.customer = { id: 'c-1', trial_started_at: started, trial_ends_at: null }
    const { loadOwnerDashboard } = await import('@/lib/owner/dashboard-data')
    const d = await loadOwnerDashboard(now)
    expect(d.billing.pilotRemainingDays).toBe(20)
  })

  it('trial_ends_at 에 NaN ISO → 기본값 30', async () => {
    db.customer = { id: 'c-1', trial_started_at: null, trial_ends_at: 'not-iso' }
    const { loadOwnerDashboard } = await import('@/lib/owner/dashboard-data')
    const d = await loadOwnerDashboard()
    expect(d.billing.pilotRemainingDays).toBe(30)
  })

  it('opts.trendDays 전달 시 반영', async () => {
    const { loadOwnerDashboard } = await import('@/lib/owner/dashboard-data')
    const d = await loadOwnerDashboard(new Date(), { trendDays: 7 })
    expect(d.trendDays).toBe(7)
    expect(mockBotSummary).toHaveBeenCalledWith([], 7, expect.any(Date))
  })

  it('places 조회 에러 → fullPlaces 빈 map (AEO 는 기본 입력으로 계산)', async () => {
    mockListOwnerPlaces.mockResolvedValueOnce([
      { id: 'p-1', slug: 's1', name: '업체1', city: 'cheonan', category: 'dermatology', status: 'active', updated_at: null },
    ])
    db.placesQueryError = { message: 'query failed' }
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { loadOwnerDashboard } = await import('@/lib/owner/dashboard-data')
    const d = await loadOwnerDashboard()
    expect(d.places).toHaveLength(1)
    consoleSpy.mockRestore()
  })

  it('admin client 없음 → billing 기본값 + sectorMap 비어있음', async () => {
    const mod = await import('@/lib/supabase/admin-client')
    vi.mocked(mod.getAdminClient).mockReturnValue(null as never)
    mockListOwnerPlaces.mockResolvedValueOnce([])
    const { loadOwnerDashboard } = await import('@/lib/owner/dashboard-data')
    const d = await loadOwnerDashboard()
    expect(d.billing.hasCard).toBe(false)
    expect(d.places).toEqual([])
    vi.mocked(mod.getAdminClient).mockImplementation(() => makeAdmin() as never)
  })

  it('detectOwnerTodos / getMeasurementWindow 호출되며 결과 전달', async () => {
    mockDetectTodos.mockReturnValueOnce([{ id: 't1', title: 'Todo1', category: 'aeo' }])
    mockGetWindow.mockReturnValueOnce({ state: 'ready', daysSinceSignup: 20 })
    const { loadOwnerDashboard } = await import('@/lib/owner/dashboard-data')
    const d = await loadOwnerDashboard()
    expect(d.todos).toHaveLength(1)
    expect(d.window.state).toBe('ready')
  })
})
