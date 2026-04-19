import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderTemplate } from '@/lib/admin/prompt-templates'

describe('renderTemplate', () => {
  it('단일 토큰 치환', () => {
    expect(renderTemplate('안녕 {{name}}', { name: '홍길동' })).toBe('안녕 홍길동')
  })

  it('여러 토큰', () => {
    expect(renderTemplate('{{name}} @ {{address}}', { name: '닥터에버스', address: '천안시' }))
      .toBe('닥터에버스 @ 천안시')
  })

  it('공백 포함 토큰', () => {
    expect(renderTemplate('{{ name }}', { name: 'x' })).toBe('x')
  })

  it('undefined → 빈 문자열', () => {
    expect(renderTemplate('{{name}} / {{missing}}', { name: 'x' })).toBe('x / ')
  })

  it('숫자 변환', () => {
    expect(renderTemplate('{{rating}}점', { rating: 4.5 })).toBe('4.5점')
  })

  it('토큰 없음 → 원문 유지', () => {
    expect(renderTemplate('그냥 텍스트', {})).toBe('그냥 텍스트')
  })
})

// ── DB 함수 ─────────────────────────────
// 체이너빌 mock: 모든 체인 메서드를 this 반환으로 연결.
const LIST_ROWS = [
  { id: 't1', category: 'dermatology', version: 2, system_prompt: 'sys2', user_template: 'user2', active: true, notes: null, created_at: '2026-04-20T00:00:00Z' },
  { id: 't2', category: 'dermatology', version: 1, system_prompt: 'sys1', user_template: 'user1', active: false, notes: 'v1', created_at: '2026-04-10T00:00:00Z' },
]
const ACTIVE_ROW = LIST_ROWS[0]

let chainResolution: Promise<{ data: unknown; error: unknown }>
let maybeSingleResolution: Promise<{ data: unknown; error: unknown }>
let singleResolution: Promise<{ data: unknown; error: unknown }>
let updateEqResolution: Promise<{ error: unknown }>
let insertSelectSingleResolution: Promise<{ data: unknown; error: unknown }>
const mockFrom = vi.fn()

vi.mock('@/lib/supabase/admin-client', () => ({
  getAdminClient: vi.fn(() => ({ from: mockFrom })),
}))

beforeEach(() => {
  chainResolution = Promise.resolve({ data: LIST_ROWS, error: null })
  maybeSingleResolution = Promise.resolve({ data: ACTIVE_ROW, error: null })
  singleResolution = Promise.resolve({ data: { category: 'dermatology' }, error: null })
  updateEqResolution = Promise.resolve({ error: null })
  insertSelectSingleResolution = Promise.resolve({ data: { id: 'new-id' }, error: null })

  mockFrom.mockReset()
  mockFrom.mockImplementation(() => {
    const selectBuilder: Record<string, unknown> = {}
    selectBuilder.eq = vi.fn(() => selectBuilder)
    selectBuilder.order = vi.fn(() => selectBuilder)
    selectBuilder.limit = vi.fn(() => ({ maybeSingle: vi.fn(() => maybeSingleResolution) }))
    selectBuilder.maybeSingle = vi.fn(() => maybeSingleResolution)
    selectBuilder.single = vi.fn(() => singleResolution)
    selectBuilder.in = vi.fn(() => selectBuilder)
    selectBuilder.then = (cb: (v: unknown) => unknown) => chainResolution.then(cb)

    const updateBuilder: Record<string, unknown> = {}
    updateBuilder.eq = vi.fn(() => ({
      eq: vi.fn(() => updateEqResolution),
      then: (cb: (v: unknown) => unknown) => updateEqResolution.then(cb),
    }))

    const insertBuilder = {
      select: vi.fn(() => ({ single: vi.fn(() => insertSelectSingleResolution) })),
    }

    return {
      select: vi.fn(() => selectBuilder),
      update: vi.fn(() => updateBuilder),
      insert: vi.fn(() => insertBuilder),
    }
  })
})

describe('listPromptTemplates', () => {
  it('admin null → []', async () => {
    const { getAdminClient } = await import('@/lib/supabase/admin-client')
    vi.mocked(getAdminClient).mockReturnValueOnce(null)
    const { listPromptTemplates } = await import('@/lib/admin/prompt-templates')
    expect(await listPromptTemplates('dermatology')).toEqual([])
  })

  it('카테고리 필터 적용 버전 내림차순', async () => {
    const { listPromptTemplates } = await import('@/lib/admin/prompt-templates')
    const r = await listPromptTemplates('dermatology')
    expect(r).toHaveLength(2)
    expect(r[0].version).toBe(2)
  })

  it('카테고리 없이도 호출 가능', async () => {
    const { listPromptTemplates } = await import('@/lib/admin/prompt-templates')
    const r = await listPromptTemplates()
    expect(r).toHaveLength(2)
  })
})

describe('getActivePromptTemplate', () => {
  it('admin null → null', async () => {
    const { getAdminClient } = await import('@/lib/supabase/admin-client')
    vi.mocked(getAdminClient).mockReturnValueOnce(null)
    const { getActivePromptTemplate } = await import('@/lib/admin/prompt-templates')
    expect(await getActivePromptTemplate('dermatology')).toBeNull()
  })

  it('active 버전 반환', async () => {
    const { getActivePromptTemplate } = await import('@/lib/admin/prompt-templates')
    const r = await getActivePromptTemplate('dermatology')
    expect(r?.id).toBe('t1')
  })
})

describe('createPromptVersion', () => {
  it('admin null → 에러', async () => {
    const { getAdminClient } = await import('@/lib/supabase/admin-client')
    vi.mocked(getAdminClient).mockReturnValueOnce(null)
    const { createPromptVersion } = await import('@/lib/admin/prompt-templates')
    const r = await createPromptVersion({ category: 'dermatology', systemPrompt: 's', userTemplate: 'u' })
    expect(r.success).toBe(false)
  })

  it('다음 버전 자동 증가 + id 반환', async () => {
    // last version = 2 (maybeSingle 반환 활용) → next = 3
    const { createPromptVersion } = await import('@/lib/admin/prompt-templates')
    const r = await createPromptVersion({ category: 'dermatology', systemPrompt: 'sys3', userTemplate: 'user3', notes: '실험' })
    expect(r.success).toBe(true)
    expect(r.id).toBe('new-id')
  })

  it('insert 에러 → 실패', async () => {
    insertSelectSingleResolution = Promise.resolve({ data: null, error: { message: 'dup' } })
    const { createPromptVersion } = await import('@/lib/admin/prompt-templates')
    const r = await createPromptVersion({ category: 'dermatology', systemPrompt: 's', userTemplate: 'u' })
    expect(r.success).toBe(false)
    expect(r.error).toBe('dup')
  })
})

describe('activatePromptVersion', () => {
  it('admin null → 에러', async () => {
    const { getAdminClient } = await import('@/lib/supabase/admin-client')
    vi.mocked(getAdminClient).mockReturnValueOnce(null)
    const { activatePromptVersion } = await import('@/lib/admin/prompt-templates')
    expect((await activatePromptVersion('t1')).success).toBe(false)
  })

  it('정상 활성화 — 기존 deactivate + 새 active', async () => {
    const { activatePromptVersion } = await import('@/lib/admin/prompt-templates')
    const r = await activatePromptVersion('t2')
    expect(r.success).toBe(true)
  })

  it('템플릿 없음 → 에러', async () => {
    singleResolution = Promise.resolve({ data: null, error: { message: 'not found' } })
    const { activatePromptVersion } = await import('@/lib/admin/prompt-templates')
    const r = await activatePromptVersion('missing')
    expect(r.success).toBe(false)
    expect(r.error).toContain('찾을 수 없')
  })
})

describe('getPromptAggregates', () => {
  it('admin null → []', async () => {
    const { getAdminClient } = await import('@/lib/supabase/admin-client')
    vi.mocked(getAdminClient).mockReturnValueOnce(null)
    const { getPromptAggregates } = await import('@/lib/admin/prompt-templates')
    expect(await getPromptAggregates('dermatology')).toEqual([])
  })

  it('템플릿별 통과율 + 평균점수 집계', async () => {
    // getPromptAggregates 는 두 번 select:
    //   1) prompt_templates: [{id, version}]
    //   2) ai_generations.eq(prompt_template_id, id): quality_scores
    // 두 번째 select 의 .eq() 는 결과를 Promise 로 반환해야 함.
    let callCount = 0
    mockFrom.mockImplementation(() => ({
      select: vi.fn(() => {
        callCount++
        if (callCount === 1) {
          // 첫 호출: prompt_templates
          return {
            eq: vi.fn(() => Promise.resolve({
              data: [{ id: 't1', version: 2 }, { id: 't2', version: 1 }],
              error: null,
            })),
          }
        }
        if (callCount === 2) {
          // 두 번째: ai_generations for t1 (3 scores avg=80, pass=2/3)
          return {
            eq: vi.fn(() => Promise.resolve({
              data: [{ quality_score: 90 }, { quality_score: 70 }, { quality_score: 80 }],
              error: null,
            })),
          }
        }
        // 세 번째: ai_generations for t2 (empty)
        return { eq: vi.fn(() => Promise.resolve({ data: [], error: null })) }
      }),
    }))

    const { getPromptAggregates } = await import('@/lib/admin/prompt-templates')
    const r = await getPromptAggregates('dermatology')
    expect(r).toHaveLength(2)
    // 정렬: version 내림차순
    expect(r[0].version).toBe(2)
    expect(r[0].calls).toBe(3)
    expect(r[0].avgScore).toBeCloseTo(80, 1)
    expect(r[0].passRate).toBeCloseTo(1, 1)    // 90/70/80 모두 ≥ 70 → 100%
    expect(r[1].calls).toBe(0)
    expect(r[1].passRate).toBe(0)
  })
})
