import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import {
  dbPlaceToPlace,
  dbCityToCity,
  dbCategoryToCategory,
  placeToDbInsert,
  type DbPlace,
  type DbCity,
  type DbCategory,
  type DbBlogPost,
} from '@/lib/supabase-types'
import type { Place } from '@/lib/types'

// --- 마이그레이션 파일 경로 ---
const MIGRATIONS_DIR = join(process.cwd(), 'supabase', 'migrations')

// ===== 1. 마이그레이션 파일 존재 검증 =====
describe('Migration files exist', () => {
  it('001_initial_schema.sql exists', () => {
    expect(existsSync(join(MIGRATIONS_DIR, '001_initial_schema.sql'))).toBe(true)
  })

  it('002_add_google_fields.sql exists', () => {
    expect(existsSync(join(MIGRATIONS_DIR, '002_add_google_fields.sql'))).toBe(true)
  })

  it('003_cities_categories_registration.sql exists', () => {
    expect(existsSync(join(MIGRATIONS_DIR, '003_cities_categories_registration.sql'))).toBe(true)
  })

  it('004_blog_posts.sql exists', () => {
    expect(existsSync(join(MIGRATIONS_DIR, '004_blog_posts.sql'))).toBe(true)
  })
})

// ===== 2. 002 마이그레이션: places 테이블 확장 =====
describe('002_add_google_fields.sql', () => {
  it('adds google_place_id column', () => {
    const sql = readMigration('002_add_google_fields.sql')
    expect(sql).toMatch(/google_place_id\s+text/i)
  })

  it('adds google_business_url column', () => {
    const sql = readMigration('002_add_google_fields.sql')
    expect(sql).toMatch(/google_business_url\s+text/i)
  })

  it('adds review_summaries jsonb column', () => {
    const sql = readMigration('002_add_google_fields.sql')
    expect(sql).toMatch(/review_summaries\s+jsonb/i)
  })

  it('adds images jsonb column', () => {
    const sql = readMigration('002_add_google_fields.sql')
    expect(sql).toMatch(/images\s+jsonb/i)
  })

  it('adds index on google_place_id', () => {
    const sql = readMigration('002_add_google_fields.sql')
    expect(sql).toMatch(/create\s+index.*google_place_id/i)
  })
})

// ===== 3. 003 마이그레이션: cities, categories, owner 연결 =====
describe('003_cities_categories_registration.sql', () => {
  it('creates cities table with slug, name, name_en', () => {
    const sql = readMigration('003_cities_categories_registration.sql')
    expect(sql).toMatch(/create\s+table.*cities/i)
    expect(sql).toMatch(/slug\s+text\s+not\s+null/i)
  })

  it('creates categories table with slug, name, name_en, icon', () => {
    const sql = readMigration('003_cities_categories_registration.sql')
    expect(sql).toMatch(/create\s+table.*categories/i)
    expect(sql).toMatch(/icon\s+text/i)
  })

  it('adds owner_id column to places', () => {
    const sql = readMigration('003_cities_categories_registration.sql')
    expect(sql).toMatch(/owner_id\s+uuid/i)
  })

  it('adds status column with check constraint', () => {
    const sql = readMigration('003_cities_categories_registration.sql')
    expect(sql).toMatch(/status\s+text/i)
    expect(sql).toMatch(/active.*pending.*rejected/i)
  })

  it('has unique constraint on cities.slug', () => {
    const sql = readMigration('003_cities_categories_registration.sql')
    expect(sql).toMatch(/slug\s+text\s+not\s+null\s+unique/i)
  })

  it('has unique constraint on categories.slug', () => {
    const sql = readMigration('003_cities_categories_registration.sql')
    // categories table also has slug unique
    expect(sql).toMatch(/categories[\s\S]*slug\s+text\s+not\s+null\s+unique/im)
  })

  it('enables RLS on cities and categories', () => {
    const sql = readMigration('003_cities_categories_registration.sql')
    expect(sql).toMatch(/enable\s+row\s+level\s+security/i)
  })

  it('owner RLS: owners can update their own places', () => {
    const sql = readMigration('003_cities_categories_registration.sql')
    expect(sql).toMatch(/owner_id\s*=\s*auth\.uid/i)
  })
})

// ===== 4. 004 마이그레이션: blog_posts =====
describe('004_blog_posts.sql', () => {
  it('creates blog_posts table', () => {
    const sql = readMigration('004_blog_posts.sql')
    expect(sql).toMatch(/create\s+table.*blog_posts/i)
  })

  it('has slug, title, summary, content columns', () => {
    const sql = readMigration('004_blog_posts.sql')
    expect(sql).toMatch(/slug\s+text\s+not\s+null/i)
    expect(sql).toMatch(/title\s+text\s+not\s+null/i)
    expect(sql).toMatch(/content\s+text\s+not\s+null/i)
  })

  it('has status with draft/published check', () => {
    const sql = readMigration('004_blog_posts.sql')
    expect(sql).toMatch(/status\s+text/i)
    expect(sql).toMatch(/draft.*published/i)
  })

  it('has published_at nullable timestamp', () => {
    const sql = readMigration('004_blog_posts.sql')
    expect(sql).toMatch(/published_at\s+timestamptz/i)
  })

  it('has city and optional category', () => {
    const sql = readMigration('004_blog_posts.sql')
    expect(sql).toMatch(/city\s+text\s+not\s+null/i)
    expect(sql).toMatch(/category\s+text/i)
  })

  it('enables RLS', () => {
    const sql = readMigration('004_blog_posts.sql')
    expect(sql).toMatch(/enable\s+row\s+level\s+security/i)
  })

  it('has unique constraint on slug', () => {
    const sql = readMigration('004_blog_posts.sql')
    expect(sql).toMatch(/slug\s+text\s+not\s+null\s+unique/i)
  })
})

// ===== 5. 변환 함수: dbPlaceToPlace =====
describe('dbPlaceToPlace', () => {
  const mockDbPlace: DbPlace = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    slug: 'soo-derm',
    name: '수피부과의원',
    name_en: 'Soo Dermatology Clinic',
    city: 'cheonan',
    category: 'dermatology',
    description: '천안시 서북구 성정동 위치.',
    address: '충남 천안시 서북구 동서대로 125-3 3층',
    phone: '+82-41-555-8833',
    opening_hours: ['Mo-Fr 09:00-18:00', 'Sa 09:00-13:00'],
    image_url: null,
    rating: 4.3,
    review_count: 210,
    services: [{ name: '여드름치료', description: '약물+레이저', priceRange: '3-10만원' }],
    faqs: [{ question: '예약은?', answer: '전화로 예약.' }],
    tags: ['여드름', '레이저'],
    naver_place_url: 'https://naver.me/GHvTSMEj',
    kakao_map_url: 'https://place.map.kakao.com/24575984',
    google_business_url: null,
    google_place_id: 'ChIJSROzO8EpezURBYXik534ATY',
    review_summaries: [{ source: 'Google', positiveThemes: ['친절'], negativeThemes: [], lastChecked: '2026-04-15' }],
    images: null,
    latitude: 36.8185,
    longitude: 127.1135,
    owner_id: null,
    status: 'active',
    created_at: '2026-04-14T00:00:00Z',
    updated_at: '2026-04-14T12:00:00Z',
  }

  it('converts snake_case DB row to camelCase Place', () => {
    const place = dbPlaceToPlace(mockDbPlace)
    expect(place.slug).toBe('soo-derm')
    expect(place.nameEn).toBe('Soo Dermatology Clinic')
    expect(place.googlePlaceId).toBe('ChIJSROzO8EpezURBYXik534ATY')
    expect(place.naverPlaceUrl).toBe('https://naver.me/GHvTSMEj')
    expect(place.reviewCount).toBe(210)
  })

  it('converts null fields to undefined', () => {
    const place = dbPlaceToPlace(mockDbPlace)
    expect(place.imageUrl).toBeUndefined()
    expect(place.googleBusinessUrl).toBeUndefined()
    expect(place.images).toBeUndefined()
  })

  it('extracts date from updated_at for lastUpdated', () => {
    const place = dbPlaceToPlace(mockDbPlace)
    expect(place.lastUpdated).toBe('2026-04-14')
  })

  it('preserves array fields', () => {
    const place = dbPlaceToPlace(mockDbPlace)
    expect(place.openingHours).toEqual(['Mo-Fr 09:00-18:00', 'Sa 09:00-13:00'])
    expect(place.tags).toEqual(['여드름', '레이저'])
    expect(place.services).toHaveLength(1)
    expect(place.faqs).toHaveLength(1)
  })

  it('preserves reviewSummaries when present', () => {
    const place = dbPlaceToPlace(mockDbPlace)
    expect(place.reviewSummaries).toHaveLength(1)
    expect(place.reviewSummaries![0].source).toBe('Google')
  })
})

// ===== 6. 변환 함수: placeToDbInsert =====
describe('placeToDbInsert', () => {
  const mockPlace: Place = {
    slug: 'test-place',
    name: '테스트의원',
    nameEn: 'Test Clinic',
    city: 'cheonan',
    category: 'dermatology',
    description: '테스트 설명',
    address: '테스트 주소',
    phone: '+82-41-000-0000',
    rating: 4.5,
    reviewCount: 100,
    services: [],
    faqs: [],
    tags: ['태그1'],
    googlePlaceId: 'ChIJtest',
    lastUpdated: '2026-04-15',
  }

  it('converts camelCase Place to snake_case DB insert', () => {
    const row = placeToDbInsert(mockPlace)
    expect(row.slug).toBe('test-place')
    expect(row.name_en).toBe('Test Clinic')
    expect(row.google_place_id).toBe('ChIJtest')
    expect(row.review_count).toBe(100)
  })

  it('converts undefined to null', () => {
    const row = placeToDbInsert(mockPlace)
    expect(row.image_url).toBeNull()
    expect(row.naver_place_url).toBeNull()
    expect(row.google_business_url).toBeNull()
    expect(row.review_summaries).toBeNull()
    expect(row.images).toBeNull()
  })

  it('sets default status to active', () => {
    const row = placeToDbInsert(mockPlace)
    expect(row.status).toBe('active')
  })

  it('sets owner_id to null for seed data', () => {
    const row = placeToDbInsert(mockPlace)
    expect(row.owner_id).toBeNull()
  })

  it('omits id, created_at, updated_at', () => {
    const row = placeToDbInsert(mockPlace)
    expect('id' in row).toBe(false)
    expect('created_at' in row).toBe(false)
    expect('updated_at' in row).toBe(false)
  })
})

// ===== 7. 변환 함수: dbCityToCity, dbCategoryToCategory =====
describe('dbCityToCity', () => {
  it('converts DB city row to City', () => {
    const dbCity: DbCity = { id: '1', slug: 'cheonan', name: '천안', name_en: 'Cheonan', created_at: '2026-04-14T00:00:00Z' }
    const city = dbCityToCity(dbCity)
    expect(city).toEqual({ slug: 'cheonan', name: '천안', nameEn: 'Cheonan' })
  })
})

describe('dbCategoryToCategory', () => {
  it('converts DB category row to Category with icon', () => {
    const dbCat: DbCategory = { id: '1', slug: 'dermatology', name: '피부과', name_en: 'Dermatology', icon: 'Stethoscope', created_at: '2026-04-14T00:00:00Z' }
    const cat = dbCategoryToCategory(dbCat)
    expect(cat).toEqual({ slug: 'dermatology', name: '피부과', nameEn: 'Dermatology', icon: 'Stethoscope' })
  })

  it('converts null icon to undefined', () => {
    const dbCat: DbCategory = { id: '1', slug: 'interior', name: '인테리어', name_en: 'Interior', icon: null, created_at: '2026-04-14T00:00:00Z' }
    const cat = dbCategoryToCategory(dbCat)
    expect(cat.icon).toBeUndefined()
  })
})

// ===== 8. DbBlogPost 타입 구조 검증 =====
describe('DbBlogPost type', () => {
  it('should accept valid blog post data', () => {
    const post: DbBlogPost = {
      id: '1',
      slug: 'cheonan-dermatology-guide',
      title: '천안 피부과 완벽 가이드',
      summary: '천안 피부과 선택 가이드',
      content: '<p>본문 내용</p>',
      city: 'cheonan',
      category: 'dermatology',
      tags: ['피부과', '천안'],
      status: 'published',
      published_at: '2026-04-15T00:00:00Z',
      created_at: '2026-04-14T00:00:00Z',
      updated_at: '2026-04-15T00:00:00Z',
    }
    expect(post.status).toBe('published')
    expect(post.tags).toHaveLength(2)
    expect(post.category).toBe('dermatology')
  })

  it('should allow null category for general posts', () => {
    const post: DbBlogPost = {
      id: '2',
      slug: 'general-post',
      title: '일반 포스트',
      summary: '요약',
      content: '내용',
      city: 'cheonan',
      category: null,
      tags: [],
      status: 'draft',
      published_at: null,
      created_at: '2026-04-14T00:00:00Z',
      updated_at: '2026-04-14T00:00:00Z',
    }
    expect(post.category).toBeNull()
    expect(post.published_at).toBeNull()
  })
})

// ===== 9. 005 마이그레이션: RLS 보안 수정 =====
describe('005_rls_fixes.sql', () => {
  it('exists', () => {
    expect(existsSync(join(MIGRATIONS_DIR, '005_rls_fixes.sql'))).toBe(true)
  })

  it('recreates owner update policy with WITH CHECK', () => {
    const sql = readMigration('005_rls_fixes.sql')
    expect(sql).toMatch(/places_owner_update/i)
    expect(sql).toMatch(/with\s+check.*status\s*=\s*'pending'/i)
  })

  it('adds DELETE policy for places', () => {
    const sql = readMigration('005_rls_fixes.sql')
    expect(sql).toMatch(/places_delete/i)
    expect(sql).toMatch(/for\s+delete/i)
  })

  it('adds DELETE policy for blog_posts', () => {
    const sql = readMigration('005_rls_fixes.sql')
    expect(sql).toMatch(/blog_posts_delete/i)
  })

  it('adds global unique index on places.slug', () => {
    const sql = readMigration('005_rls_fixes.sql')
    expect(sql).toMatch(/unique\s+index.*places.*slug/i)
  })
})

// ===== 10. 006 마이그레이션: owner 컬럼 가드 =====
describe('006_owner_column_guard.sql', () => {
  it('exists', () => {
    expect(existsSync(join(MIGRATIONS_DIR, '006_owner_column_guard.sql'))).toBe(true)
  })

  it('creates guard_owner_columns function', () => {
    const sql = readMigration('006_owner_column_guard.sql')
    expect(sql).toMatch(/guard_owner_columns/i)
  })

  it('protects rating, review_count, google_place_id from owner updates', () => {
    const sql = readMigration('006_owner_column_guard.sql')
    expect(sql).toMatch(/new\.rating\s*:=\s*old\.rating/i)
    expect(sql).toMatch(/new\.review_count\s*:=\s*old\.review_count/i)
    expect(sql).toMatch(/new\.google_place_id\s*:=\s*old\.google_place_id/i)
  })

  it('protects status and owner_id from owner updates', () => {
    const sql = readMigration('006_owner_column_guard.sql')
    expect(sql).toMatch(/new\.status\s*:=\s*old\.status/i)
    expect(sql).toMatch(/new\.owner_id\s*:=\s*old\.owner_id/i)
  })

  it('allows service_role to bypass guard', () => {
    const sql = readMigration('006_owner_column_guard.sql')
    expect(sql).toMatch(/service_role[\s\S]*return\s+new/i)
  })
})

// ===== 11. 변환 함수: null 분기 커버리지 =====
describe('dbPlaceToPlace — all-null optional fields', () => {
  it('converts all-null optional fields to undefined', () => {
    const row: DbPlace = {
      id: '1', slug: 'x', name: 'X', name_en: null, city: 'c', category: 'c',
      description: 'd', address: 'a', phone: null, opening_hours: null,
      image_url: null, rating: null, review_count: 0, services: [], faqs: [],
      tags: [], naver_place_url: null, kakao_map_url: null,
      google_business_url: null, google_place_id: null,
      review_summaries: null, images: null, latitude: null, longitude: null,
      owner_id: null, status: 'pending',
      created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
    }
    const place = dbPlaceToPlace(row)
    expect(place.nameEn).toBeUndefined()
    expect(place.phone).toBeUndefined()
    expect(place.openingHours).toBeUndefined()
    expect(place.imageUrl).toBeUndefined()
    expect(place.rating).toBeUndefined()
    expect(place.naverPlaceUrl).toBeUndefined()
    expect(place.kakaoMapUrl).toBeUndefined()
    expect(place.googleBusinessUrl).toBeUndefined()
    expect(place.googlePlaceId).toBeUndefined()
    expect(place.reviewSummaries).toBeUndefined()
    expect(place.images).toBeUndefined()
    expect(place.latitude).toBeUndefined()
    expect(place.longitude).toBeUndefined()
  })
})

describe('placeToDbInsert — all-present optional fields', () => {
  it('preserves values when all optional fields are present', () => {
    const place: Place = {
      slug: 'full', name: 'Full', nameEn: 'Full', city: 'c', category: 'c',
      description: 'd', address: 'a', phone: '+82-00', openingHours: ['Mo 09:00-18:00'],
      imageUrl: 'https://img.test/1.jpg', rating: 5.0, reviewCount: 999,
      services: [{ name: 's' }], faqs: [{ question: 'q', answer: 'a' }],
      tags: ['t'], naverPlaceUrl: 'https://naver.me/x', kakaoMapUrl: 'https://kakao/x',
      googleBusinessUrl: 'https://g.co/x', googlePlaceId: 'ChIJfull',
      reviewSummaries: [{ source: 'Google', positiveThemes: [], negativeThemes: [], lastChecked: '2026-01-01' }],
      images: [{ url: 'https://img.test/1.jpg', alt: 'alt', type: 'exterior' }],
      latitude: 36.0, longitude: 127.0, lastUpdated: '2026-01-01',
    }
    const row = placeToDbInsert(place)
    expect(row.name_en).toBe('Full')
    expect(row.phone).toBe('+82-00')
    expect(row.opening_hours).toEqual(['Mo 09:00-18:00'])
    expect(row.image_url).toBe('https://img.test/1.jpg')
    expect(row.rating).toBe(5.0)
    expect(row.review_count).toBe(999)
    expect(row.naver_place_url).toBe('https://naver.me/x')
    expect(row.kakao_map_url).toBe('https://kakao/x')
    expect(row.google_business_url).toBe('https://g.co/x')
    expect(row.google_place_id).toBe('ChIJfull')
    expect(row.review_summaries).toHaveLength(1)
    expect(row.images).toHaveLength(1)
    expect(row.latitude).toBe(36.0)
    expect(row.longitude).toBe(127.0)
  })
})

// --- Helper ---
function readMigration(filename: string): string {
  const filepath = join(MIGRATIONS_DIR, filename)
  if (!existsSync(filepath)) {
    throw new Error(`Migration file not found: ${filepath}`)
  }
  return readFileSync(filepath, 'utf-8')
}
