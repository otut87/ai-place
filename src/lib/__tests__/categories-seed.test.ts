/**
 * Phase 5+6: 카테고리 Schema.org 매핑 + 시드 데이터 검증
 * - 5개 카테고리 모두 Schema.org subtype 매핑
 * - data.ts에 5개 카테고리 시드
 * - validate-pages.ts에 신규 subtype 포함
 * - Supabase 시드 SQL 존재
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

const CATEGORIES = [
  { slug: 'dermatology', name: '피부과', schemaType: 'MedicalClinic', sector: 'medical' },
  { slug: 'interior', name: '인테리어', schemaType: 'HomeAndConstructionBusiness', sector: 'living' },
  { slug: 'webagency', name: '웹에이전시', schemaType: 'ProfessionalService', sector: 'professional' },
  { slug: 'auto-repair', name: '자동차정비', schemaType: 'AutoRepair', sector: 'auto' },
  { slug: 'hairsalon', name: '미용실', schemaType: 'BeautySalon', sector: 'beauty' },
]

// ===== 1. JSON-LD Schema.org 매핑 =====
describe('JSON-LD CATEGORY_SCHEMA_MAP', () => {
  for (const cat of CATEGORIES) {
    it(`${cat.slug} → ${cat.schemaType}`, async () => {
      const { generateLocalBusiness } = await import('@/lib/jsonld')
      const place = { slug: 't', name: 'T', city: 'c', category: cat.slug, description: 'd', address: 'a', services: [], faqs: [], tags: [] }
      expect(generateLocalBusiness(place)['@type']).toBe(cat.schemaType)
    })
  }
})

// ===== 2. data.ts 카테고리 시드 =====
describe('data.ts 카테고리 시드', () => {
  it('5개 카테고리가 모두 존재', async () => {
    const { getCategories } = await import('@/lib/data')
    const cats = await getCategories()
    expect(cats.length).toBeGreaterThanOrEqual(5)

    for (const expected of CATEGORIES) {
      const found = cats.find(c => c.slug === expected.slug)
      expect(found, `${expected.slug} 카테고리 누락`).toBeDefined()
      expect(found!.name).toBe(expected.name)
    }
  })

  it('모든 카테고리에 nameEn 존재', async () => {
    const { getCategories } = await import('@/lib/data')
    const cats = await getCategories()
    for (const cat of cats) {
      expect(cat.nameEn, `${cat.slug}: nameEn 누락`).toBeTruthy()
    }
  })

  it('모든 카테고리에 sector가 정의되어 있어야 함', async () => {
    const { getCategories, getSectors } = await import('@/lib/data')
    const cats = await getCategories()
    const sectorSlugs = (await getSectors()).map(s => s.slug)
    for (const cat of cats) {
      expect(cat.sector, `${cat.slug}: sector 누락`).toBeTruthy()
      expect(sectorSlugs, `${cat.slug}: sector "${cat.sector}"가 sectors에 없음`).toContain(cat.sector)
    }
  })

  it('sector를 통해 schemaType이 올바르게 결정되어야 함', async () => {
    const { getSchemaTypeForCategory } = await import('@/lib/data')
    for (const expected of CATEGORIES) {
      const schemaType = await getSchemaTypeForCategory(expected.slug)
      expect(schemaType, `${expected.slug}: schemaType 불일치`).toBe(expected.schemaType)
    }
  })
})

// ===== 3. validate-pages.ts subtype 체크 =====
describe('validate-pages.ts LocalBusiness subtype', () => {
  it('ProfessionalService 포함', () => {
    const content = readFileSync(join(process.cwd(), 'scripts/validate-pages.ts'), 'utf-8')
    expect(content).toContain('ProfessionalService')
  })

  it('AutoRepair 포함', () => {
    const content = readFileSync(join(process.cwd(), 'scripts/validate-pages.ts'), 'utf-8')
    expect(content).toContain('AutoRepair')
  })
})

// ===== 4. Supabase 시드 SQL =====
describe('Supabase 시드 SQL', () => {
  it('007_seed_cities_categories.sql 존재', () => {
    expect(existsSync(join(process.cwd(), 'supabase/migrations/007_seed_cities_categories.sql'))).toBe(true)
  })

  it('5개 카테고리 INSERT 포함', () => {
    const sql = readFileSync(join(process.cwd(), 'supabase/migrations/007_seed_cities_categories.sql'), 'utf-8')
    for (const cat of CATEGORIES) {
      expect(sql, `${cat.slug} 시드 누락`).toContain(cat.slug)
    }
  })

  it('천안 도시 INSERT 포함', () => {
    const sql = readFileSync(join(process.cwd(), 'supabase/migrations/007_seed_cities_categories.sql'), 'utf-8')
    expect(sql).toContain('cheonan')
  })
})
