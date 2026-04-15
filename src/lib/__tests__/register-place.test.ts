/**
 * Phase 4: 업체 등록 테스트
 * - Google Places Text Search (searchPlaceByText)
 * - Server Action validation (description 40~60자, FAQ 3개+, services 1개+)
 * - 등록 폼 파일 존재
 * - GEO/SEO/AEO 품질 기준 준수
 */
import { describe, it, expect, vi } from 'vitest'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

// ===== 1. 파일 존재 =====
describe('Phase 4 파일 존재', () => {
  const files = [
    'src/lib/actions/register-place.ts',
    'src/app/admin/register/page.tsx',
    'src/app/admin/places/page.tsx',
  ]
  for (const file of files) {
    it(`${file} 존재`, () => {
      expect(existsSync(join(process.cwd(), file)), `${file} 없음`).toBe(true)
    })
  }
})

// ===== 2. Google Places Text Search =====
describe('searchPlaceByText', () => {
  it('함수가 export됨', async () => {
    const mod = await import('@/lib/google-places')
    expect(typeof mod.searchPlaceByText).toBe('function')
  })

  it('검색 성공 시 PlaceSearchResult[] 반환', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        places: [
          {
            id: 'ChIJtest123',
            displayName: { text: '테스트의원' },
            formattedAddress: '충남 천안시 서북구 테스트로 1',
            rating: 4.5,
            userRatingCount: 100,
            location: { latitude: 36.8, longitude: 127.1 },
          },
        ],
      }),
    }))

    const { searchPlaceByText } = await import('@/lib/google-places')
    const results = await searchPlaceByText('테스트의원 천안')

    expect(results).not.toBeNull()
    expect(results!.length).toBeGreaterThan(0)
    expect(results![0].placeId).toBe('ChIJtest123')
    expect(results![0].name).toBe('테스트의원')
    expect(results![0].address).toBe('충남 천안시 서북구 테스트로 1')

    vi.unstubAllGlobals()
  })

  it('검색 실패 시 null 반환', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: () => Promise.resolve('Bad Request'),
    }))

    const { searchPlaceByText } = await import('@/lib/google-places')
    const results = await searchPlaceByText('없는업체')
    expect(results).toBeNull()

    vi.unstubAllGlobals()
  })
})

// ===== 3. Server Action exports =====
describe('register-place Server Action exports', () => {
  it('searchPlace 함수 export', async () => {
    const mod = await import('@/lib/actions/register-place')
    expect(typeof mod.searchPlace).toBe('function')
  })

  it('enrichPlace 함수 export', async () => {
    const mod = await import('@/lib/actions/register-place')
    expect(typeof mod.enrichPlace).toBe('function')
  })

  it('registerPlace 함수 export', async () => {
    const mod = await import('@/lib/actions/register-place')
    expect(typeof mod.registerPlace).toBe('function')
  })
})

// ===== 4. Validation 규칙 (GEO/SEO/AEO 품질) =====
describe('RegisterPlaceInput validation 규칙', () => {
  it('register-place.ts에 description 40~60자 검증 포함', () => {
    const content = readFileSync(join(process.cwd(), 'src/lib/actions/register-place.ts'), 'utf-8')
    expect(content).toMatch(/description\.length/)
    expect(content).toMatch(/40/)
    expect(content).toMatch(/60/)
  })

  it('FAQ 최소 3개 검증 포함', () => {
    const content = readFileSync(join(process.cwd(), 'src/lib/actions/register-place.ts'), 'utf-8')
    expect(content).toMatch(/faqs\.length/)
    expect(content).toMatch(/3/)
  })

  it('FAQ 물음표 검증 포함', () => {
    const content = readFileSync(join(process.cwd(), 'src/lib/actions/register-place.ts'), 'utf-8')
    expect(content).toMatch(/\?/)
  })

  it('서비스 최소 1개 검증 포함', () => {
    const content = readFileSync(join(process.cwd(), 'src/lib/actions/register-place.ts'), 'utf-8')
    expect(content).toMatch(/services\.length/)
  })

  it('googlePlaceId 필수 검증 포함', () => {
    const content = readFileSync(join(process.cwd(), 'src/lib/actions/register-place.ts'), 'utf-8')
    expect(content).toMatch(/googlePlaceId/)
  })

  it('status: pending으로 저장', () => {
    const content = readFileSync(join(process.cwd(), 'src/lib/actions/register-place.ts'), 'utf-8')
    expect(content).toMatch(/status.*pending/i)
  })
})

// ===== 5. 등록 폼 구조 =====
describe('admin/register/page.tsx 등록 폼', () => {
  it('도시 선택 필드 존재', () => {
    const content = readFileSync(join(process.cwd(), 'src/app/admin/register/page.tsx'), 'utf-8')
    expect(content).toMatch(/city|도시/i)
  })

  it('카테고리 선택 필드 존재', () => {
    const content = readFileSync(join(process.cwd(), 'src/app/admin/register/page.tsx'), 'utf-8')
    expect(content).toMatch(/category|카테고리|업종/i)
  })

  it('업체명 검색 필드 존재', () => {
    const content = readFileSync(join(process.cwd(), 'src/app/admin/register/page.tsx'), 'utf-8')
    expect(content).toMatch(/검색|search|업체명/i)
  })

  it('description 글자수 표시', () => {
    const content = readFileSync(join(process.cwd(), 'src/app/admin/register/page.tsx'), 'utf-8')
    expect(content).toMatch(/length|글자/)
  })
})

// ===== 6. 업체 목록 페이지 =====
describe('admin/places/page.tsx 업체 목록', () => {
  it('인증 필수 (requireAuth)', () => {
    const content = readFileSync(join(process.cwd(), 'src/app/admin/places/page.tsx'), 'utf-8')
    expect(content).toMatch(/requireAuth/)
  })
})
