/**
 * blog/migrate.ts 테스트 (T-010e)
 *
 * 12개 기존 페이지(8 keyword + 3 compare + 1 guide)를 blog_posts insert payload 로 변환.
 * 슬러그 규칙: {city}-{category}-{topic}
 * 마이그레이션 스크립트가 dry-run 모드 + DB insert 두 모드 모두 지원.
 */
import { describe, it, expect } from 'vitest'
import {
  keywordPageToInsert,
  comparisonPageToInsert,
  guidePageToInsert,
  buildBlogSlug,
  type BlogInsertPayload,
} from '@/lib/blog/migrate'
import type { KeywordPage, ComparisonPage, GuidePage } from '@/lib/types'

// --- 샘플 데이터 ---
const sampleKeyword: KeywordPage = {
  slug: 'acne',
  city: 'cheonan',
  category: 'dermatology',
  targetQuery: '천안 여드름 피부과 추천',
  title: '천안 여드름 피부과 추천 — 2026년 업데이트',
  summary: '천안 여드름 치료 전문 피부과 2곳을 비교.',
  relatedPlaceSlugs: ['cleanhue', 'alive-skin'],
  faqs: [{ question: 'Q', answer: 'A' }],
  statistics: [{ label: '평균 비용', value: '5~15만원/회' }],
  sources: [{ name: '대한피부과학회', url: 'https://derma.or.kr', year: 2025 }],
  lastUpdated: '2026-04-14',
}

const sampleComparison: ComparisonPage = {
  topic: { slug: 'acne-treatment', name: '여드름 치료 비교', city: 'cheonan', category: 'dermatology' },
  summary: '천안 피부과 3곳의 여드름 치료 비교.',
  entries: [
    {
      placeSlug: 'cleanhue',
      placeName: '클린휴의원',
      methods: ['약물+레이저'],
      priceRange: '3-10만원',
      specialties: ['여드름'],
      pros: ['금요 야간진료'],
      cons: ['동남구 위치'],
    },
    {
      placeSlug: 'alive-skin',
      placeName: '얼라이브피부과 천안아산점',
      methods: ['복합 치료'],
      priceRange: '5-15만원',
      specialties: ['난치성 여드름'],
      pros: ['난치성 전문'],
      cons: ['거리'],
    },
  ],
  statistics: [{ label: '평균 비용', value: '5-15만원' }],
  faqs: [{ question: 'Q', answer: 'A' }],
  sources: [{ name: '대한피부과학회', url: 'https://derma.or.kr', year: 2025 }],
  lastUpdated: '2026-04-14',
}

const sampleGuide: GuidePage = {
  city: 'cheonan',
  category: 'dermatology',
  title: '천안 피부과 선택 가이드',
  summary: '천안 피부과 4곳 종합 정리.',
  sections: [
    {
      heading: '선택 기준',
      content: '전문 분야와 접근성 고려.',
      items: ['전문 분야', '접근성'],
      recommendedPlaces: [
        { slug: 'dr-evers', name: '닥터에버스의원 천안점', reason: '리프팅 전문' },
        { slug: 'cleanhue', name: '클린휴의원', reason: '여드름 전문' },
      ],
    },
    {
      heading: '비용 안내',
      content: '5-30만원 범위.',
    },
  ],
  statistics: [{ label: '등록 업체', value: '4곳' }],
  faqs: [{ question: 'Q', answer: 'A' }],
  sources: [{ name: 'AI플레이스', year: 2026 }],
  lastUpdated: '2026-04-14',
}

// ===== 1. buildBlogSlug =====
describe('buildBlogSlug', () => {
  it('city + category + topic 으로 슬러그 생성', () => {
    expect(buildBlogSlug('cheonan', 'dermatology', 'acne')).toBe('cheonan-dermatology-acne')
  })
  it('가이드는 -guide 접미', () => {
    expect(buildBlogSlug('cheonan', 'dermatology', 'guide')).toBe('cheonan-dermatology-guide')
  })
})

// ===== 2. keywordPageToInsert =====
describe('keywordPageToInsert', () => {
  const out: BlogInsertPayload = keywordPageToInsert(sampleKeyword, 'medical')

  it('post_type=keyword 설정', () => {
    expect(out.post_type).toBe('keyword')
  })
  it('슬러그 city-category-keywordSlug', () => {
    expect(out.slug).toBe('cheonan-dermatology-acne')
  })
  it('city/sector/category 매핑', () => {
    expect(out.city).toBe('cheonan')
    expect(out.sector).toBe('medical')
    expect(out.category).toBe('dermatology')
  })
  it('related_place_slugs = relatedPlaceSlugs', () => {
    expect(out.related_place_slugs).toEqual(['cleanhue', 'alive-skin'])
  })
  it('target_query = targetQuery', () => {
    expect(out.target_query).toBe('천안 여드름 피부과 추천')
  })
  it('faqs / statistics 그대로 전달', () => {
    expect(out.faqs).toEqual([{ question: 'Q', answer: 'A' }])
    expect(out.statistics).toEqual([{ label: '평균 비용', value: '5~15만원/회' }])
  })
  it('sources: name → title 매핑, url 보존', () => {
    expect(out.sources).toEqual([
      { title: '대한피부과학회', url: 'https://derma.or.kr' },
    ])
  })
  it('content는 비어있지 않은 markdown', () => {
    expect(out.content.length).toBeGreaterThan(0)
    expect(out.content).toContain(sampleKeyword.title)
  })
  it('status=active, view_count=0', () => {
    expect(out.status).toBe('active')
    expect(out.view_count).toBe(0)
  })
})

// ===== 3. comparisonPageToInsert =====
describe('comparisonPageToInsert', () => {
  const out: BlogInsertPayload = comparisonPageToInsert(sampleComparison, 'medical')

  it('post_type=compare', () => {
    expect(out.post_type).toBe('compare')
  })
  it('슬러그 city-category-topicSlug', () => {
    expect(out.slug).toBe('cheonan-dermatology-acne-treatment')
  })
  it('title은 topic.name', () => {
    expect(out.title).toBe('여드름 치료 비교')
  })
  it('related_place_slugs 는 entries 에서 추출 (중복 제거)', () => {
    expect(out.related_place_slugs).toEqual(['cleanhue', 'alive-skin'])
  })
  it('target_query null', () => {
    expect(out.target_query).toBeNull()
  })
  it('content 에 비교 표 markdown 포함 (entries 이름)', () => {
    expect(out.content).toContain('클린휴의원')
    expect(out.content).toContain('얼라이브피부과 천안아산점')
  })
})

// ===== 4. guidePageToInsert =====
describe('guidePageToInsert', () => {
  const out: BlogInsertPayload = guidePageToInsert(sampleGuide, 'medical')

  it('post_type=guide', () => {
    expect(out.post_type).toBe('guide')
  })
  it('슬러그 city-category-guide', () => {
    expect(out.slug).toBe('cheonan-dermatology-guide')
  })
  it('related_place_slugs 는 sections.recommendedPlaces 에서 추출', () => {
    expect(out.related_place_slugs).toEqual(['dr-evers', 'cleanhue'])
  })
  it('target_query null', () => {
    expect(out.target_query).toBeNull()
  })
  it('content 에 모든 section heading 포함', () => {
    expect(out.content).toContain('선택 기준')
    expect(out.content).toContain('비용 안내')
  })
})

// ===== 5. 통합: 12개 변환 시나리오 =====
describe('통합 변환 (12개 페이지)', () => {
  it('keyword 8 + compare 3 + guide 1 = 모두 unique slug', async () => {
    const data = await import('@/lib/data')
    const allKeywords = await data.getAllKeywordPages()
    const compTopics = await data.getAllComparisonTopics()
    const allGuides = await data.getAllGuidePages()

    const inserts: BlogInsertPayload[] = []
    for (const k of allKeywords) {
      const full = await data.getKeywordPage(k.city, k.category, k.slug)
      if (full) inserts.push(keywordPageToInsert(full, 'medical'))
    }
    for (const t of compTopics) {
      const full = await data.getComparisonPage(t.city, t.category, t.slug)
      if (full) inserts.push(comparisonPageToInsert(full, 'medical'))
    }
    for (const g of allGuides) {
      inserts.push(guidePageToInsert(g, 'medical'))
    }

    expect(inserts.length).toBeGreaterThanOrEqual(12)
    const slugs = inserts.map(i => i.slug)
    expect(new Set(slugs).size).toBe(slugs.length) // 중복 없음
  })
})
