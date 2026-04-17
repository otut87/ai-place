/**
 * blog/data.supabase.ts 테스트 (T-010b)
 *
 * 전략:
 * - Supabase 클라이언트 mock (체이닝 가능)
 * - 성공 경로: snake_case → camelCase 변환 검증
 * - 실패 경로: error/null 시 빈 배열 또는 null 폴백
 * - relatedPlaceSlugs 역방향 조회 (배열 contains)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ===== Mock infrastructure =====
type MockResolve = { data: unknown; error: unknown }

function makeChain(resolveValue: MockResolve) {
  // 모든 체이닝 메서드는 자기 자신 반환, then() 으로 await 됨
  const chain: Record<string, unknown> = {}
  chain.select = vi.fn().mockReturnValue(chain)
  chain.eq = vi.fn().mockReturnValue(chain)
  chain.contains = vi.fn().mockReturnValue(chain)
  chain.in = vi.fn().mockReturnValue(chain)
  chain.order = vi.fn().mockReturnValue(chain)
  chain.limit = vi.fn().mockReturnValue(chain)
  chain.single = vi.fn().mockReturnValue(chain)
  chain.maybeSingle = vi.fn().mockReturnValue(chain)
  chain.then = vi.fn((onResolve: (v: MockResolve) => void) => onResolve(resolveValue))
  Object.assign(chain, Promise.resolve(resolveValue))
  return chain
}

const mockFrom = vi.fn(() => ({
  select: vi.fn().mockReturnValue(makeChain({ data: null, error: { message: 'default mock' } })),
}))

vi.mock('@/lib/supabase/read-client', () => ({
  getReadClient: vi.fn(() => ({ from: mockFrom })),
}))

beforeEach(() => {
  mockFrom.mockReset()
})

// ===== Sample DB row =====
const sampleRow = {
  id: 'b1',
  slug: 'cheonan-dermatology-acne',
  title: '천안 여드름 피부과 추천',
  summary: '천안에서 여드름 치료를 잘하는 피부과 4곳을 정리.',
  content: '# 본문\n\n천안 여드름 피부과 4곳…',
  city: 'cheonan',
  sector: 'medical',
  category: 'dermatology',
  tags: ['여드름', '피부과'],
  status: 'active' as const,
  published_at: '2026-04-15T00:00:00Z',
  created_at: '2026-04-14T00:00:00Z',
  updated_at: '2026-04-15T00:00:00Z',
  post_type: 'keyword' as const,
  related_place_slugs: ['chnp-derm', 'chen-derm'],
  target_query: '천안 여드름 피부과 추천',
  faqs: [{ question: 'Q', answer: 'A' }],
  statistics: [{ label: '활성 업체', value: '4곳' }],
  sources: [{ title: 'src', url: 'https://x' }],
  view_count: 120,
  quality_score: 85,
}

// ===== 1. 모듈 시그니처 =====
describe('blog/data.supabase 모듈 시그니처', () => {
  it('6개 export 함수를 가짐', async () => {
    const mod = await import('@/lib/blog/data.supabase')
    expect(mod.getBlogPost).toBeDefined()
    expect(mod.getBlogPostsByCity).toBeDefined()
    expect(mod.getBlogPostsBySector).toBeDefined()
    expect(mod.getRecentBlogPosts).toBeDefined()
    expect(mod.getPopularBlogPosts).toBeDefined()
    expect(mod.getBlogPostsByPlace).toBeDefined()
  })
})

// ===== 2. getBlogPost: 단일 조회 =====
describe('getBlogPost', () => {
  it('Supabase 성공 시 BlogPost 반환 (snake → camel 변환)', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue(makeChain({ data: [sampleRow], error: null })),
    })
    const { getBlogPost } = await import('@/lib/blog/data.supabase')
    const post = await getBlogPost('cheonan', 'medical', 'cheonan-dermatology-acne')
    expect(post).not.toBeNull()
    expect(post?.slug).toBe('cheonan-dermatology-acne')
    expect(post?.postType).toBe('keyword')
    expect(post?.relatedPlaceSlugs).toEqual(['chnp-derm', 'chen-derm'])
    expect(post?.viewCount).toBe(120)
    expect(post?.targetQuery).toBe('천안 여드름 피부과 추천')
  })

  it('데이터 없으면 null 반환', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue(makeChain({ data: [], error: null })),
    })
    const { getBlogPost } = await import('@/lib/blog/data.supabase')
    const post = await getBlogPost('cheonan', 'medical', 'nonexistent')
    expect(post).toBeNull()
  })

  it('Supabase error 시 null 반환 (catch)', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue(makeChain({ data: null, error: { message: 'fail' } })),
    })
    const { getBlogPost } = await import('@/lib/blog/data.supabase')
    const post = await getBlogPost('cheonan', 'medical', 'x')
    expect(post).toBeNull()
  })
})

// ===== 3. 목록 조회 =====
describe('getBlogPostsByCity', () => {
  it('성공 시 BlogPostSummary 배열 반환', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue(makeChain({ data: [sampleRow], error: null })),
    })
    const { getBlogPostsByCity } = await import('@/lib/blog/data.supabase')
    const posts = await getBlogPostsByCity('cheonan')
    expect(posts).toHaveLength(1)
    expect(posts[0].slug).toBe('cheonan-dermatology-acne')
    expect(posts[0].postType).toBe('keyword')
    // BlogPostSummary 는 content 필드를 가지지 않음
    expect((posts[0] as unknown as { content: string }).content).toBeUndefined()
  })

  it('실패 시 빈 배열', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue(makeChain({ data: null, error: { message: 'fail' } })),
    })
    const { getBlogPostsByCity } = await import('@/lib/blog/data.supabase')
    const posts = await getBlogPostsByCity('cheonan')
    expect(posts).toEqual([])
  })
})

describe('getBlogPostsBySector', () => {
  it('도시 + sector 필터로 조회', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue(makeChain({ data: [sampleRow], error: null })),
    })
    const { getBlogPostsBySector } = await import('@/lib/blog/data.supabase')
    const posts = await getBlogPostsBySector('cheonan', 'medical')
    expect(posts).toHaveLength(1)
    expect(posts[0].sector).toBe('medical')
  })
})

describe('getRecentBlogPosts', () => {
  it('limit 파라미터로 개수 제한', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue(makeChain({ data: [sampleRow, sampleRow], error: null })),
    })
    const { getRecentBlogPosts } = await import('@/lib/blog/data.supabase')
    const posts = await getRecentBlogPosts(10)
    expect(posts).toHaveLength(2)
  })

  it('실패 시 빈 배열', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue(makeChain({ data: null, error: { message: 'fail' } })),
    })
    const { getRecentBlogPosts } = await import('@/lib/blog/data.supabase')
    const posts = await getRecentBlogPosts(10)
    expect(posts).toEqual([])
  })
})

describe('getPopularBlogPosts', () => {
  it('view_count 기준 정렬', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue(makeChain({ data: [sampleRow], error: null })),
    })
    const { getPopularBlogPosts } = await import('@/lib/blog/data.supabase')
    const posts = await getPopularBlogPosts(5)
    expect(posts).toHaveLength(1)
    expect(posts[0].viewCount).toBe(120)
  })
})

describe('getAllActiveBlogPosts (T-010d generateStaticParams)', () => {
  it('모든 active 글의 라우팅 키 반환 (city/sector/slug)', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue(makeChain({ data: [sampleRow], error: null })),
    })
    const { getAllActiveBlogPosts } = await import('@/lib/blog/data.supabase')
    const out = await getAllActiveBlogPosts()
    expect(out).toHaveLength(1)
    expect(out[0]).toEqual({
      city: 'cheonan',
      sector: 'medical',
      slug: 'cheonan-dermatology-acne',
    })
  })

  it('실패 시 빈 배열', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue(makeChain({ data: null, error: { message: 'fail' } })),
    })
    const { getAllActiveBlogPosts } = await import('@/lib/blog/data.supabase')
    const out = await getAllActiveBlogPosts()
    expect(out).toEqual([])
  })
})

describe('getBlogPostsByPlace', () => {
  it('related_place_slugs 역방향 조회 (placeSlug 포함)', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue(makeChain({ data: [sampleRow], error: null })),
    })
    const { getBlogPostsByPlace } = await import('@/lib/blog/data.supabase')
    const posts = await getBlogPostsByPlace('chnp-derm')
    expect(posts).toHaveLength(1)
    expect(posts[0].slug).toBe('cheonan-dermatology-acne')
  })

  it('일치 없으면 빈 배열', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue(makeChain({ data: [], error: null })),
    })
    const { getBlogPostsByPlace } = await import('@/lib/blog/data.supabase')
    const posts = await getBlogPostsByPlace('zzz')
    expect(posts).toEqual([])
  })
})
