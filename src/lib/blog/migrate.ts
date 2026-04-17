// AI Place — Blog Migration Helpers (T-010e, Phase 1.5)
// 기존 KeywordPage / ComparisonPage / GuidePage 12개를 blog_posts insert payload 로 변환.
// CLI 스크립트(scripts/migrate-to-blog.ts) 가 이 변환 함수를 사용.

import type {
  KeywordPage,
  ComparisonPage,
  GuidePage,
  Source,
} from '../types'
import type { DbBlogPost } from '../supabase-types'

/** insert payload — id/created_at/updated_at 은 DB 가 채움 */
export type BlogInsertPayload = Omit<DbBlogPost, 'id' | 'created_at' | 'updated_at'>

/** {city}-{category}-{topic} 슬러그 규칙 */
export function buildBlogSlug(city: string, category: string, topic: string): string {
  return `${city}-${category}-${topic}`
}

/** Source(name/url/year) → blog_posts.sources({ title, url }) */
function convertSources(sources: readonly Source[]): Array<{ title: string; url: string }> {
  return sources.map(s => ({ title: s.name, url: s.url ?? '' }))
}

/** ISO date "YYYY-MM-DD" → ISO datetime 으로 보정 */
function toIsoDateTime(d: string): string {
  // 이미 datetime 이면 그대로, 아니면 자정으로 보정
  return d.includes('T') ? d : `${d}T00:00:00Z`
}

// --- KeywordPage → blog_posts ---

export function keywordPageToInsert(page: KeywordPage, sector: string): BlogInsertPayload {
  const slug = buildBlogSlug(page.city, page.category, page.slug)
  const content = renderKeywordContent(page)
  return {
    slug,
    title: page.title,
    summary: page.summary,
    content,
    city: page.city,
    sector,
    category: page.category,
    tags: [page.category, page.slug],
    status: 'active',
    published_at: toIsoDateTime(page.lastUpdated),
    post_type: 'keyword',
    related_place_slugs: [...page.relatedPlaceSlugs],
    target_query: page.targetQuery,
    faqs: page.faqs.map(f => ({ question: f.question, answer: f.answer })),
    statistics: page.statistics.map(s => ({ label: s.label, value: s.value, ...(s.note ? { note: s.note } : {}) })),
    sources: convertSources(page.sources),
    view_count: 0,
    quality_score: null,
  }
}

function renderKeywordContent(page: KeywordPage): string {
  const lines: string[] = []
  lines.push(`# ${page.title}`, '')
  lines.push(`> ${page.summary}`, '')
  if (page.targetQuery) lines.push(`**타깃 검색어**: ${page.targetQuery}`, '')

  if (page.statistics.length > 0) {
    lines.push('## 핵심 통계', '')
    for (const s of page.statistics) {
      lines.push(`- **${s.label}**: ${s.value}${s.note ? ` _(${s.note})_` : ''}`)
    }
    lines.push('')
  }

  if (page.faqs.length > 0) {
    lines.push('## 자주 묻는 질문', '')
    for (const f of page.faqs) {
      lines.push(`### ${f.question}`, '', f.answer, '')
    }
  }

  if (page.relatedPlaceSlugs.length > 0) {
    lines.push('## 관련 업체', '')
    lines.push(`연결된 업체: ${page.relatedPlaceSlugs.join(', ')}`, '')
  }

  return lines.join('\n')
}

// --- ComparisonPage → blog_posts ---

export function comparisonPageToInsert(page: ComparisonPage, sector: string): BlogInsertPayload {
  const { topic } = page
  const slug = buildBlogSlug(topic.city, topic.category, topic.slug)
  const content = renderComparisonContent(page)
  // 중복 제거 (entries 에 같은 placeSlug 가 두 번 나오지 않도록 방어)
  const places = Array.from(new Set(page.entries.map(e => e.placeSlug)))
  return {
    slug,
    title: topic.name,
    summary: page.summary,
    content,
    city: topic.city,
    sector,
    category: topic.category,
    tags: [topic.category, topic.slug, '비교'],
    status: 'active',
    published_at: toIsoDateTime(page.lastUpdated),
    post_type: 'compare',
    related_place_slugs: places,
    target_query: null,
    faqs: page.faqs.map(f => ({ question: f.question, answer: f.answer })),
    statistics: page.statistics.map(s => ({ label: s.label, value: s.value, ...(s.note ? { note: s.note } : {}) })),
    sources: convertSources(page.sources),
    view_count: 0,
    quality_score: null,
  }
}

function renderComparisonContent(page: ComparisonPage): string {
  const lines: string[] = []
  lines.push(`# ${page.topic.name}`, '')
  lines.push(`> ${page.summary}`, '')

  if (page.entries.length > 0) {
    lines.push('## 비교표', '')
    for (const e of page.entries) {
      lines.push(`### ${e.placeName}`)
      lines.push(`- **방법**: ${e.methods.join(', ')}`)
      lines.push(`- **가격대**: ${e.priceRange}`)
      lines.push(`- **전문 분야**: ${e.specialties.join(', ')}`)
      lines.push(`- **장점**: ${e.pros.join(' / ')}`)
      lines.push(`- **단점**: ${e.cons.join(' / ')}`)
      lines.push('')
    }
  }

  if (page.statistics.length > 0) {
    lines.push('## 통계', '')
    for (const s of page.statistics) {
      lines.push(`- **${s.label}**: ${s.value}${s.note ? ` _(${s.note})_` : ''}`)
    }
    lines.push('')
  }

  if (page.faqs.length > 0) {
    lines.push('## 자주 묻는 질문', '')
    for (const f of page.faqs) {
      lines.push(`### ${f.question}`, '', f.answer, '')
    }
  }

  return lines.join('\n')
}

// --- GuidePage → blog_posts ---

export function guidePageToInsert(page: GuidePage, sector: string): BlogInsertPayload {
  const slug = buildBlogSlug(page.city, page.category, 'guide')
  const content = renderGuideContent(page)
  // recommendedPlaces 에서 slug 수집 (중복 제거)
  const places = Array.from(
    new Set(
      page.sections.flatMap(s => (s.recommendedPlaces ?? []).map(r => r.slug)),
    ),
  )
  return {
    slug,
    title: page.title,
    summary: page.summary,
    content,
    city: page.city,
    sector,
    category: page.category,
    tags: [page.category, '가이드'],
    status: 'active',
    published_at: toIsoDateTime(page.lastUpdated),
    post_type: 'guide',
    related_place_slugs: places,
    target_query: null,
    faqs: page.faqs.map(f => ({ question: f.question, answer: f.answer })),
    statistics: page.statistics.map(s => ({ label: s.label, value: s.value, ...(s.note ? { note: s.note } : {}) })),
    sources: convertSources(page.sources),
    view_count: 0,
    quality_score: null,
  }
}

function renderGuideContent(page: GuidePage): string {
  const lines: string[] = []
  lines.push(`# ${page.title}`, '')
  lines.push(`> ${page.summary}`, '')

  for (const section of page.sections) {
    lines.push(`## ${section.heading}`, '', section.content, '')
    if (section.items && section.items.length > 0) {
      for (const it of section.items) lines.push(`- ${it}`)
      lines.push('')
    }
    if (section.recommendedPlaces && section.recommendedPlaces.length > 0) {
      lines.push('**추천 업체**')
      for (const r of section.recommendedPlaces) {
        lines.push(`- **${r.name}** — ${r.reason}`)
      }
      lines.push('')
    }
  }

  if (page.statistics.length > 0) {
    lines.push('## 통계', '')
    for (const s of page.statistics) {
      lines.push(`- **${s.label}**: ${s.value}${s.note ? ` _(${s.note})_` : ''}`)
    }
    lines.push('')
  }

  if (page.faqs.length > 0) {
    lines.push('## 자주 묻는 질문', '')
    for (const f of page.faqs) {
      lines.push(`### ${f.question}`, '', f.answer, '')
    }
  }

  return lines.join('\n')
}
