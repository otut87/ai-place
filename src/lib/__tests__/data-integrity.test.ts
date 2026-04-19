/**
 * Seed data integrity tests — prevent ghost business references.
 *
 * Background (T-001 / WO-#1): 수피부과의원 was de-listed in 2026-04-16 but
 * 12 references remained in seed text fields (FAQs, guide content, statistics),
 * causing AI/Google to surface non-existent businesses.
 *
 * These tests act as a regression guard for any future de-listings.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import {
  getAllPlaces,
  getAllGuidePages,
  getAllComparisonTopics,
  getAllKeywordPages,
  getComparisonPage,
  getKeywordPage,
} from '../data'
import type { Place, GuidePage, ComparisonPage, KeywordPage } from '../types'

/**
 * Businesses that have been de-listed (closed, moved out of region, etc.).
 * Add new entries here when removing a place — tests will fail until all
 * references are scrubbed from seed text.
 */
const DEFUNCT_BUSINESSES: ReadonlyArray<{ name: string; aliases?: string[] }> = [
  { name: '수피부과의원', aliases: ['수피부과', 'soo-derm', '에버스피부과'] },
]

let allPlaces: Place[] = []
let allGuides: GuidePage[] = []
const allComparisons: ComparisonPage[] = []
const allKeywords: KeywordPage[] = []
let allTextBlocks: Array<{ source: string; text: string }> = []

beforeAll(async () => {
  allPlaces = await getAllPlaces()
  allGuides = await getAllGuidePages()

  const compTopics = await getAllComparisonTopics()
  for (const t of compTopics) {
    const c = await getComparisonPage(t.city, t.category, t.slug)
    if (c) allComparisons.push(c)
  }

  const kwSummaries = await getAllKeywordPages()
  for (const k of kwSummaries) {
    const full = await getKeywordPage(k.city, k.category, k.slug)
    if (full) allKeywords.push(full)
  }

  // Collect all free-text fields once.
  const blocks: Array<{ source: string; text: string }> = []

  for (const place of allPlaces) {
    blocks.push({ source: `place[${place.slug}].description`, text: place.description })
    for (const f of place.faqs) {
      blocks.push({ source: `place[${place.slug}].faq.q`, text: f.question })
      blocks.push({ source: `place[${place.slug}].faq.a`, text: f.answer })
    }
  }

  for (const guide of allGuides) {
    const tag = `guide[${guide.city}/${guide.category}]`
    blocks.push({ source: `${tag}.summary`, text: guide.summary })
    for (const s of guide.sections) {
      blocks.push({ source: `${tag}.section.content`, text: s.content })
      for (const item of s.items ?? []) {
        blocks.push({ source: `${tag}.section.item`, text: item })
      }
    }
    for (const f of guide.faqs) {
      blocks.push({ source: `${tag}.faq.a`, text: f.answer })
    }
    for (const stat of guide.statistics) {
      blocks.push({ source: `${tag}.stat.label`, text: stat.label })
      blocks.push({ source: `${tag}.stat.value`, text: stat.value })
      if (stat.note) blocks.push({ source: `${tag}.stat.note`, text: stat.note })
    }
  }

  for (const comp of allComparisons) {
    const tag = `compare[${comp.topic.slug}]`
    blocks.push({ source: `${tag}.summary`, text: comp.summary })
    for (const f of comp.faqs) {
      blocks.push({ source: `${tag}.faq.a`, text: f.answer })
    }
    for (const stat of comp.statistics) {
      blocks.push({ source: `${tag}.stat.label`, text: stat.label })
      blocks.push({ source: `${tag}.stat.value`, text: stat.value })
      if (stat.note) blocks.push({ source: `${tag}.stat.note`, text: stat.note })
    }
  }

  for (const kw of allKeywords) {
    const tag = `keyword[${kw.slug}]`
    blocks.push({ source: `${tag}.summary`, text: kw.summary })
    for (const f of kw.faqs) {
      blocks.push({ source: `${tag}.faq.a`, text: f.answer })
    }
    for (const stat of kw.statistics) {
      blocks.push({ source: `${tag}.stat.label`, text: stat.label })
      blocks.push({ source: `${tag}.stat.value`, text: stat.value })
      if (stat.note) blocks.push({ source: `${tag}.stat.note`, text: stat.note })
    }
  }

  allTextBlocks = blocks
})

describe('seed data integrity — defunct businesses', () => {
  for (const defunct of DEFUNCT_BUSINESSES) {
    const needles = [defunct.name, ...(defunct.aliases ?? [])]
    for (const needle of needles) {
      it(`no seed text mentions defunct business: "${needle}"`, () => {
        const hits = allTextBlocks
          .filter(b => b.text.includes(needle))
          .map(b => b.source)
        expect(hits, `Found "${needle}" in:\n${hits.join('\n')}`).toEqual([])
      })
    }
  }
})

describe('seed data integrity — recommended places must be registered', () => {
  it('all guide.recommendedPlaces.slug values exist in places list', () => {
    const slugs = new Set(allPlaces.map(p => p.slug))
    const violations: string[] = []
    for (const guide of allGuides) {
      for (const section of guide.sections) {
        for (const rec of section.recommendedPlaces ?? []) {
          if (!slugs.has(rec.slug)) {
            violations.push(
              `guide[${guide.city}/${guide.category}].section[${section.heading}] → ${rec.slug}`,
            )
          }
        }
      }
    }
    expect(violations, `Unknown slugs:\n${violations.join('\n')}`).toEqual([])
  })

  it('all comparisonPages.entries.placeSlug values exist in places list', () => {
    const slugs = new Set(allPlaces.map(p => p.slug))
    const violations: string[] = []
    for (const comp of allComparisons) {
      for (const entry of comp.entries) {
        if (!slugs.has(entry.placeSlug)) {
          violations.push(`compare[${comp.topic.slug}].entry → ${entry.placeSlug}`)
        }
      }
    }
    expect(violations, `Unknown slugs:\n${violations.join('\n')}`).toEqual([])
  })

  it('all keywordPages.relatedPlaceSlugs values exist in places list', () => {
    const slugs = new Set(allPlaces.map(p => p.slug))
    const violations: string[] = []
    for (const kw of allKeywords) {
      for (const slug of kw.relatedPlaceSlugs) {
        if (!slugs.has(slug)) {
          violations.push(`keyword[${kw.slug}].relatedPlaceSlugs → ${slug}`)
        }
      }
    }
    expect(violations, `Unknown slugs:\n${violations.join('\n')}`).toEqual([])
  })
})

describe('seed data integrity — count claims match active places', () => {
  it('dermatology guide does not claim wrong place count (e.g., "5곳" when 4)', () => {
    const dermPlaces = allPlaces.filter(p => p.category === 'dermatology' && p.city === 'cheonan')
    const expectedCount = dermPlaces.length

    const dermGuide = allGuides.find(g => g.city === 'cheonan' && g.category === 'dermatology')
    if (!dermGuide) return

    const allText = [
      dermGuide.summary,
      ...dermGuide.sections.flatMap(s => [s.content, ...(s.items ?? [])]),
      ...dermGuide.faqs.map(f => f.answer),
    ].join('\n')

    // Detect counts like "5곳", "5명의 전문" — limited 1~10 to avoid prices.
    const matches = [...allText.matchAll(/(\d+)\s*(곳|명의 전문)/g)]
    const wrongCounts = matches
      .map(m => ({ raw: m[0], n: Number(m[1]) }))
      .filter(({ n }) => n !== expectedCount && n > 1 && n <= 10)

    expect(
      wrongCounts.map(w => w.raw),
      `Guide mentions counts that don't match active places (expected ${expectedCount}곳)`,
    ).toEqual([])
  })
})

describe('seed data integrity — exports exist', () => {
  it('cities/categories/places loaded successfully', () => {
    expect(allPlaces.length).toBeGreaterThan(0)
  })
})
