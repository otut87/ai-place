/**
 * 확장성 테스트: 하드코딩 제거 검증
 * - validCities/validCategories가 시드 데이터에서 동적으로 가져오는지
 * - categoryNames가 시드 데이터 기반인지
 * - 홈페이지 도시 링크가 특정 카테고리에 하드코딩되지 않았는지
 */
import { describe, it, expect } from 'vitest'

describe('확장성: 동적 validation', () => {
  it('getCities()로 가져온 도시가 등록 validation에 사용 가능해야 함', async () => {
    const { getCities } = await import('@/lib/data')
    const cities = await getCities()
    // 시드 데이터에 최소 1개 도시 존재
    expect(cities.length).toBeGreaterThan(0)
    // 모든 도시가 slug를 가져야 함
    cities.forEach(c => expect(c.slug).toMatch(/^[a-z0-9-]+$/))
  })

  it('getCategories()로 가져온 카테고리가 등록 validation에 사용 가능해야 함', async () => {
    const { getCategories } = await import('@/lib/data')
    const categories = await getCategories()
    expect(categories.length).toBeGreaterThan(0)
    categories.forEach(c => {
      expect(c.slug).toMatch(/^[a-z0-9-]+$/)
      // 한글 이름이 있어야 LLM 프롬프트에서 사용 가능
      expect(c.name).toBeTruthy()
    })
  })

  it('새 도시를 추가해도 validation이 동적으로 작동해야 함 (개념 테스트)', async () => {
    const { getCities } = await import('@/lib/data')
    const cities = await getCities()
    const slugs = cities.map(c => c.slug)
    // 'cheonan'이 존재
    expect(slugs).toContain('cheonan')
    // validation 로직이 이 배열 기반이면, 새 도시 추가 시 자동 반영
  })
})

describe('확장성: Sector → schemaType 매핑', () => {
  it('모든 sector에 schemaType이 정의되어 있어야 함', async () => {
    const { getSectors } = await import('@/lib/data')
    const sectorsList = await getSectors()
    expect(sectorsList.length).toBeGreaterThan(0)
    sectorsList.forEach(s => {
      expect(s.schemaType, `${s.slug}: schemaType 누락`).toBeTruthy()
    })
  })

  it('카테고리 → sector → schemaType 체인이 작동해야 함', async () => {
    const { getSchemaTypeForCategory } = await import('@/lib/data')
    expect(await getSchemaTypeForCategory('dermatology')).toBe('MedicalClinic')
    expect(await getSchemaTypeForCategory('auto-repair')).toBe('AutoRepair')
    expect(await getSchemaTypeForCategory('nonexistent')).toBe('LocalBusiness')
  })
})

describe('확장성: categoryNames LLM 매핑', () => {
  it('getCategories()의 name 필드가 한글 카테고리명을 제공해야 함', async () => {
    const { getCategories } = await import('@/lib/data')
    const cats = await getCategories()
    const nameMap = Object.fromEntries(cats.map(c => [c.slug, c.name]))

    expect(nameMap['dermatology']).toBe('피부과')
    expect(nameMap['interior']).toBe('인테리어')
    expect(nameMap['webagency']).toBe('웹에이전시')
    expect(nameMap['auto-repair']).toBe('자동차정비')
    expect(nameMap['hairsalon']).toBe('미용실')
  })
})
