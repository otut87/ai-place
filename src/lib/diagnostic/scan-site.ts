// T-137 v3 — AI 검색 인용 진단 (멀티 페이지 스캔).
// v2 대비 변경점:
//   1) 사이트맵 존재 → 최대 8 페이지 병렬 fetch 후 스키마 집계 ("어느 페이지든 있으면 pass")
//   2) 사이트맵 없음 → 홈페이지 단독 스캔 + 경고 (AI 크롤러가 상세 페이지 발견 불가)
//   3) 관습 경로 추측(/faq 등) 폐기 — 사이트맵이 게이트키퍼
//
// 점수 가중치 (총 100):
//   GEO 핵심:  55  (jsonld 20, robots 15, faq 15, review 5)
//   AEO:      20  (direct_answer 10, sameas 5, last_updated 5)
//   SEO 기초:  25  (title 5, desc 5, sitemap 8, llms 2, https 3, viewport 2)

export interface ScanResult {
  url: string
  fetchedAt: string
  score: number
  checks: CheckResult[]
  error?: string
  pagesScanned: number      // 실제 성공적으로 fetch 된 페이지 수
  sitemapPresent: boolean   // 사이트맵 존재 여부 (UI 경고 배너용)
  sampledPages?: string[]   // 스캔된 페이지 경로 (디버깅/UI 표시용)
}

export interface CheckResult {
  id: CheckId
  label: string
  category: 'geo' | 'aeo' | 'seo'
  status: 'pass' | 'warn' | 'fail'
  points: number
  maxPoints: number
  detail?: string
  reference?: string          // 문서 §표기
  foundOn?: string            // schema 가 발견된 페이지 경로
  evidence?: string           // T-145: 발견된 JSON-LD 일부 발췌 (디버깅·증거용, 최대 500자)
}

export type CheckId =
  | 'jsonld_localbusiness'
  | 'robots_ai_allow'
  | 'faq_schema'
  | 'review_schema'
  | 'breadcrumb_schema'       // T-146 신규
  | 'direct_answer_block'
  | 'sameas_entity_linking'
  | 'last_updated'
  | 'time_markup'             // T-146 신규
  | 'author_person_schema'    // T-146 신규
  | 'title'
  | 'meta_description'
  | 'sitemap'
  | 'llms_txt'
  | 'https'
  | 'viewport'

// T-146: 신규 체크 3종 추가에 따른 가중치 재조정 (총 100).
//   - breadcrumb_schema (4) — Google Rich Results · AI 경로 파악
//   - time_markup (2) — Freshness 보완
//   - author_person_schema (4) — E-E-A-T §4.1 (+40% 인용률)
// 기존에서 회수: jsonld 20→18, faq 15→12, direct 10→9, sitemap 8→7, llms 2→1, viewport 2→1
const WEIGHTS: Record<CheckId, number> = {
  jsonld_localbusiness: 18,
  robots_ai_allow: 15,
  faq_schema: 12,
  review_schema: 5,
  breadcrumb_schema: 4,
  direct_answer_block: 9,
  sameas_entity_linking: 5,
  last_updated: 5,
  time_markup: 2,
  author_person_schema: 4,
  title: 5,
  meta_description: 5,
  sitemap: 7,
  llms_txt: 1,
  https: 2,
  viewport: 1,
}

const FETCH_TIMEOUT_MS = 10_000
const MAX_SAMPLE_PAGES = 49       // 홈 포함 최대 50 페이지 (고유 route pattern 기준)
const FETCH_CONCURRENCY = 8       // T-148: 6 → 8 병렬 증가 (속도 개선)
const USER_AGENT = 'AIPlaceDiagnostic/3.1 (+https://aiplace.kr/check)'

interface PageScan {
  url: string
  path: string
  html: string
  nodes: NodeWithSource[]
}

interface NodeWithSource {
  node: Record<string, unknown>
  pageUrl: string
  pagePath: string
}

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS)
  try {
    return await fetch(url, {
      ...init,
      headers: { 'User-Agent': USER_AGENT, ...(init?.headers ?? {}) },
      signal: ctrl.signal,
      redirect: 'follow',
    })
  } finally {
    clearTimeout(timer)
  }
}

// T-143: 재현성 보장용 1회 재시도 (5xx·네트워크 에러만).
// 재진단 시 일시적 서버 오류로 점수가 흔들리는 것 방지.
async function fetchWithRetry(url: string, init?: RequestInit): Promise<Response> {
  try {
    const res = await fetchWithTimeout(url, init)
    if (res.status >= 500 && res.status < 600) {
      return await fetchWithTimeout(url, init)
    }
    return res
  } catch (err) {
    // 네트워크 에러 1회 재시도 후 원본 에러 throw
    try {
      return await fetchWithTimeout(url, init)
    } catch {
      throw err
    }
  }
}

function normalizeUrl(input: string): URL | null {
  try {
    const withProto = /^https?:\/\//i.test(input) ? input : `https://${input}`
    return new URL(withProto)
  } catch {
    return null
  }
}

function urlPath(u: string): string {
  try { return new URL(u).pathname } catch { return u }
}

function displayWidth(text: string): number {
  let width = 0
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0
    if (
      (code >= 0xAC00 && code <= 0xD7A3) ||
      (code >= 0x4E00 && code <= 0x9FFF) ||
      (code >= 0x3040 && code <= 0x30FF)
    ) width += 2
    else width += 1
  }
  return width
}

function collectJsonLdNodes(html: string, pageUrl: string): NodeWithSource[] {
  const out: NodeWithSource[] = []
  const path = urlPath(pageUrl)
  const matches = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
  for (const m of matches) {
    try {
      const parsed = JSON.parse(m[1])
      const list = Array.isArray(parsed) ? parsed : [parsed]
      for (const item of list) {
        const rec = item as Record<string, unknown>
        if (Array.isArray(rec['@graph'])) {
          for (const g of rec['@graph'] as unknown[]) out.push({ node: g as Record<string, unknown>, pageUrl, pagePath: path })
        } else {
          out.push({ node: rec, pageUrl, pagePath: path })
        }
      }
    } catch { /* skip */ }
  }
  return out
}

function typesOf(node: Record<string, unknown>): string[] {
  const t = node['@type']
  if (!t) return []
  return (Array.isArray(t) ? t : [t]).filter((x): x is string => typeof x === 'string')
}

// ---------- 페이지 fetch ----------

async function scanPage(url: string): Promise<PageScan | null> {
  try {
    const res = await fetchWithRetry(url)
    if (!res.ok) return null
    const html = await res.text()
    return { url, path: urlPath(url), html, nodes: collectJsonLdNodes(html, url) }
  } catch {
    return null
  }
}

// 동시성 제한 배치 fetch — 서버 부담 완화 및 타임아웃 파편화 방지.
async function scanPagesBatched(urls: string[], concurrency: number): Promise<PageScan[]> {
  const results: PageScan[] = []
  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency)
    const batchResults = await Promise.all(batch.map(scanPage))
    for (const r of batchResults) if (r) results.push(r)
  }
  return results
}

// ---------- 사이트맵 샘플링 ----------

async function sampleSitemapUrls(
  origin: string,
  homeUrl: string,
  limit = MAX_SAMPLE_PAGES,
): Promise<{ present: boolean; urls: string[] }> {
  let res: Response
  try {
    res = await fetchWithTimeout(`${origin}/sitemap.xml`)
  } catch {
    return { present: false, urls: [] }
  }
  if (!res.ok) return { present: false, urls: [] }

  const xml = await res.text()
  const urlSet = new Set<string>()

  // 일반 사이트맵: <url><loc>...</loc></url>
  for (const m of xml.matchAll(/<url>[\s\S]*?<loc>([^<]+)<\/loc>[\s\S]*?<\/url>/gi)) {
    const u = m[1].trim()
    if (u.startsWith(origin) && u !== homeUrl) urlSet.add(u)
  }

  // 사이트맵 인덱스: <sitemap><loc>.../nested.xml</loc></sitemap>
  if (urlSet.size === 0) {
    const nested: string[] = []
    for (const m of xml.matchAll(/<sitemap>[\s\S]*?<loc>([^<]+)<\/loc>[\s\S]*?<\/sitemap>/gi)) {
      nested.push(m[1].trim())
    }
    // 최대 2 nested 만 팔로우 (타임아웃 방지)
    for (const ns of nested.slice(0, 2)) {
      if (urlSet.size >= limit) break
      try {
        const r = await fetchWithTimeout(ns)
        if (!r.ok) continue
        const x2 = await r.text()
        for (const m2 of x2.matchAll(/<url>[\s\S]*?<loc>([^<]+)<\/loc>[\s\S]*?<\/url>/gi)) {
          const u = m2[1].trim()
          if (u.startsWith(origin) && u !== homeUrl) urlSet.add(u)
          if (urlSet.size >= limit * 3) break
        }
      } catch { /* skip */ }
    }
  }

  // 샘플링 전략: route pattern 그룹화.
  // URL 을 (depth, parentPath) 로 그룹핑 → 같은 템플릿끼리 묶임.
  //   /cheonan/derma/A, /cheonan/derma/B, ... → 같은 키 → 1개만 샘플
  //   /about, /blog, /cheonan → 같은 키(depth 1) → ≤3개 그룹이면 전부
  // 이유: "같은 템플릿 반복 fetch" 는 무의미하고, "서로 다른 경로 = 다른 템플릿" 은 반드시 검사해야 스키마 구멍 발견.
  const groups = new Map<string, string[]>()
  for (const u of urlSet) {
    const p = urlPath(u)
    const segments = p.split('/').filter(Boolean)
    const depth = segments.length
    const parent = segments.slice(0, -1).join('/')
    const key = `${depth}|${parent}`
    const list = groups.get(key) ?? []
    list.push(u)
    groups.set(key, list)
  }

  // FAQ/상세 경로 우선순위 부여: 먼저 뽑히도록 그룹 순서 정렬
  const groupEntries = [...groups.entries()].sort((a, b) => {
    const scoreGroup = (key: string, urls: string[]) => {
      if (urls.some(u => /\/(faq|faqs|q-?and-?a|questions)(\/|$)/i.test(urlPath(u)))) return 0
      const depth = Number(key.split('|')[0])
      if (depth >= 3) return 1           // 상세 페이지 그룹 먼저
      if (depth === 2) return 2
      return 3
    }
    return scoreGroup(a[0], a[1]) - scoreGroup(b[0], b[1])
  })

  const picked: string[] = []
  for (const [, urls] of groupEntries) {
    if (picked.length >= limit) break
    // 그룹 크기 ≤ 3: 전부 샘플 (서로 다른 템플릿일 가능성)
    // 그룹 크기 > 3: 1개만 (같은 템플릿 반복)
    const take = urls.length <= 3 ? urls.length : 1
    for (let i = 0; i < take && picked.length < limit; i++) {
      picked.push(urls[i])
    }
  }

  return { present: true, urls: picked }
}

// ---------- 개별 체크 ----------

function checkHttps(url: URL): CheckResult {
  const pass = url.protocol === 'https:'
  return {
    id: 'https', label: 'HTTPS', category: 'seo',
    status: pass ? 'pass' : 'fail',
    points: pass ? WEIGHTS.https : 0, maxPoints: WEIGHTS.https,
    detail: pass ? '안전한 HTTPS 연결' : 'HTTP — AI 크롤러 신뢰도 낮음',
  }
}

function checkJsonLdLocalBusiness(allNodes: NodeWithSource[]): CheckResult {
  const SPECIFIC_RE = /Dentist|MedicalClinic|BeautySalon|HairSalon|Restaurant|Store|ProfessionalService|AutoBodyShop|ChildCare|EducationalOrganization|AccountingService|LegalService|VeterinaryCare|GasStation/i
  const GENERIC_RE = /LocalBusiness/i

  let best: { ns: NodeWithSource; specific: boolean } | null = null
  for (const ns of allNodes) {
    const ts = typesOf(ns.node)
    const hasSpecific = ts.some(t => SPECIFIC_RE.test(t))
    if (hasSpecific) { best = { ns, specific: true }; break }
    if (!best && ts.some(t => GENERIC_RE.test(t))) best = { ns, specific: false }
  }

  if (!best) {
    return {
      id: 'jsonld_localbusiness', label: 'JSON-LD LocalBusiness', category: 'geo',
      status: 'fail', points: 0, maxPoints: WEIGHTS.jsonld_localbusiness,
      detail: 'AI가 업체 정보를 구조적으로 읽을 수 없습니다 — 인용 진입 실패',
      reference: '§5.3',
    }
  }

  const n = best.ns.node
  const hasName = Boolean(n.name)
  const hasAddress = Boolean(n.address)
  const hasPhone = Boolean(n.telephone)
  const hasHours = Boolean(n.openingHoursSpecification || n.openingHours)
  const fields = [hasName, hasAddress, hasPhone, hasHours].filter(Boolean).length
  const points = Math.round(WEIGHTS.jsonld_localbusiness * (0.4 + (best.specific ? 0.2 : 0) + (fields / 4) * 0.4))
  const full = best.specific && fields === 4

  return {
    id: 'jsonld_localbusiness', label: 'JSON-LD LocalBusiness', category: 'geo',
    status: full ? 'pass' : 'warn', points, maxPoints: WEIGHTS.jsonld_localbusiness,
    detail: `${best.specific ? `구체 subtype (${typesOf(n).join(',')})` : '일반 LocalBusiness — Dentist/Restaurant 등 구체화 권장'} · 필수필드 ${fields}/4 (name=${hasName ? '✓' : '✗'}, address=${hasAddress ? '✓' : '✗'}, phone=${hasPhone ? '✓' : '✗'}, hours=${hasHours ? '✓' : '✗'})`,
    reference: '§5.3',
    foundOn: best.ns.pagePath,
  }
}

async function checkRobotsAiAllow(origin: string): Promise<CheckResult> {
  try {
    const res = await fetchWithTimeout(`${origin}/robots.txt`)
    if (!res.ok) {
      return {
        id: 'robots_ai_allow', label: 'robots.txt AI 크롤러 허용', category: 'geo',
        status: 'warn', points: Math.round(WEIGHTS.robots_ai_allow * 0.6), maxPoints: WEIGHTS.robots_ai_allow,
        detail: `robots.txt 없음 (HTTP ${res.status}) — 기본 허용이지만 명시 권장`, reference: '§5.1',
      }
    }
    const txt = await res.text()
    const aiBots = ['GPTBot', 'ClaudeBot', 'Claude-User', 'Claude-SearchBot', 'PerplexityBot', 'OAI-SearchBot', 'Google-Extended']
    const blocked: string[] = []
    for (const bot of aiBots) {
      const re = new RegExp(`User-agent:\\s*${bot}[\\s\\S]*?(?=User-agent:|$)`, 'gi')
      const blockMatch = txt.match(re)
      if (blockMatch && /Disallow:\s*\/\s*$/m.test(blockMatch[0])) blocked.push(bot)
    }
    const globalBlocked = /User-agent:\s*\*[\s\S]*?Disallow:\s*\/\s*$/m.test(txt)
    if (globalBlocked) {
      return {
        id: 'robots_ai_allow', label: 'robots.txt AI 크롤러 허용', category: 'geo',
        status: 'fail', points: 0, maxPoints: WEIGHTS.robots_ai_allow,
        detail: 'User-agent: * 에 Disallow: / — 모든 크롤러 차단', reference: '§5.1',
      }
    }
    if (blocked.length > 0) {
      return {
        id: 'robots_ai_allow', label: 'robots.txt AI 크롤러 허용', category: 'geo',
        status: 'fail', points: Math.round(WEIGHTS.robots_ai_allow * 0.3), maxPoints: WEIGHTS.robots_ai_allow,
        detail: `차단된 AI 크롤러: ${blocked.join(', ')} — 인용 풀에서 완전 제외`, reference: '§5.1',
      }
    }
    return {
      id: 'robots_ai_allow', label: 'robots.txt AI 크롤러 허용', category: 'geo',
      status: 'pass', points: WEIGHTS.robots_ai_allow, maxPoints: WEIGHTS.robots_ai_allow,
      detail: `${aiBots.length}종 AI 크롤러 모두 접근 가능`, reference: '§5.1',
    }
  } catch (err) {
    return {
      id: 'robots_ai_allow', label: 'robots.txt AI 크롤러 허용', category: 'geo',
      status: 'warn', points: Math.round(WEIGHTS.robots_ai_allow * 0.5), maxPoints: WEIGHTS.robots_ai_allow,
      detail: `조회 실패: ${err instanceof Error ? err.message : 'unknown'}`, reference: '§5.1',
    }
  }
}

function checkFaqSchema(allNodes: NodeWithSource[]): CheckResult {
  let faq: NodeWithSource | null = null
  for (const ns of allNodes) {
    if (typesOf(ns.node).some(t => /FAQPage/i.test(t))) { faq = ns; break }
  }
  if (!faq) {
    return {
      id: 'faq_schema', label: 'FAQPage schema', category: 'geo',
      status: 'fail', points: 0, maxPoints: WEIGHTS.faq_schema,
      detail: 'FAQPage 스키마 없음 — 문서 기준 인용률 2.7~3.2배 차이 (홈·/faq·상세 중 어느 페이지에든 없음)',
      reference: '§4.3',
    }
  }
  const me = faq.node.mainEntity
  const qs = Array.isArray(me) ? me : me ? [me] : []
  const count = qs.length

  if (count >= 5) return {
    id: 'faq_schema', label: 'FAQPage schema', category: 'geo',
    status: 'pass', points: WEIGHTS.faq_schema, maxPoints: WEIGHTS.faq_schema,
    detail: `Q&A ${count}개 (권장 5개 이상)`, reference: '§4.3', foundOn: faq.pagePath,
  }
  if (count >= 3) return {
    id: 'faq_schema', label: 'FAQPage schema', category: 'geo',
    status: 'warn', points: Math.round(WEIGHTS.faq_schema * 0.7), maxPoints: WEIGHTS.faq_schema,
    detail: `Q&A ${count}개 (권장 5개 이상)`, reference: '§4.3', foundOn: faq.pagePath,
  }
  return {
    id: 'faq_schema', label: 'FAQPage schema', category: 'geo',
    status: 'warn', points: Math.round(WEIGHTS.faq_schema * 0.4), maxPoints: WEIGHTS.faq_schema,
    detail: `FAQPage 존재하나 Q&A ${count}개 — 최소 5개 권장`, reference: '§4.3', foundOn: faq.pagePath,
  }
}

function checkReviewSchema(allNodes: NodeWithSource[]): CheckResult {
  let hasAggregate = false
  let hasReview = false
  let ratingValue: number | null = null
  let reviewCount: number | null = null
  let foundOn: string | undefined

  for (const ns of allNodes) {
    const n = ns.node
    const ar = n.aggregateRating as Record<string, unknown> | undefined
    if (ar && typeof ar === 'object') {
      hasAggregate = true
      foundOn = foundOn ?? ns.pagePath
      const rv = Number(ar.ratingValue)
      const rc = Number(ar.reviewCount ?? ar.ratingCount)
      if (!Number.isNaN(rv) && ratingValue === null) ratingValue = rv
      if (!Number.isNaN(rc) && reviewCount === null) reviewCount = rc
    }
    if (n.review) { hasReview = true; foundOn = foundOn ?? ns.pagePath }
    if (typesOf(n).some(t => /^Review$/i.test(t))) { hasReview = true; foundOn = foundOn ?? ns.pagePath }
  }

  // AggregateRating (집계 평점) 은 AI가 인용할 때 가장 중요한 수치 신호.
  // 개별 Review 텍스트는 대부분 타 플랫폼(네이버·카카오) 복제라 저작권 이슈가 있어
  // 수집·노출하지 않는 것이 모범 사례 (§13.2). 따라서 AggregateRating 단독도 만점 처리.
  if (hasAggregate) return {
    id: 'review_schema', label: 'AggregateRating (집계 평점)', category: 'geo',
    status: 'pass', points: WEIGHTS.review_schema, maxPoints: WEIGHTS.review_schema,
    detail: `평점 ${ratingValue ?? '?'}/5 · 리뷰 ${reviewCount ?? '?'}개 — ChatGPT 리뷰 선호 신호 완비`,
    reference: '§3.1', foundOn,
  }
  if (hasReview) return {
    id: 'review_schema', label: 'AggregateRating (집계 평점)', category: 'geo',
    status: 'warn', points: Math.round(WEIGHTS.review_schema * 0.6), maxPoints: WEIGHTS.review_schema,
    detail: '개별 Review schema만 있고 AggregateRating(집계 평점) 누락 — 수치 신호가 핵심',
    reference: '§3.1', foundOn,
  }
  return {
    id: 'review_schema', label: 'Review · AggregateRating schema', category: 'geo',
    status: 'fail', points: 0, maxPoints: WEIGHTS.review_schema,
    detail: '리뷰·평점 schema 없음 (샘플 페이지 전체 검사)', reference: '§3.1',
  }
}

// T-146: BreadcrumbList schema — Google Rich Results + AI 경로 파악용.
function checkBreadcrumbSchema(allNodes: NodeWithSource[]): CheckResult {
  let bc: NodeWithSource | null = null
  for (const ns of allNodes) {
    if (typesOf(ns.node).some(t => /BreadcrumbList/i.test(t))) { bc = ns; break }
  }
  if (!bc) return {
    id: 'breadcrumb_schema', label: 'BreadcrumbList schema', category: 'geo',
    status: 'fail', points: 0, maxPoints: WEIGHTS.breadcrumb_schema,
    detail: 'BreadcrumbList schema 없음 — 페이지 계층 AI 인식 저하', reference: '§5.3',
  }
  const items = bc.node.itemListElement
  const count = Array.isArray(items) ? items.length : 0
  if (count >= 2) return {
    id: 'breadcrumb_schema', label: 'BreadcrumbList schema', category: 'geo',
    status: 'pass', points: WEIGHTS.breadcrumb_schema, maxPoints: WEIGHTS.breadcrumb_schema,
    detail: `${count}단계 경로`, reference: '§5.3', foundOn: bc.pagePath,
  }
  return {
    id: 'breadcrumb_schema', label: 'BreadcrumbList schema', category: 'geo',
    status: 'warn', points: Math.round(WEIGHTS.breadcrumb_schema * 0.5), maxPoints: WEIGHTS.breadcrumb_schema,
    detail: `itemListElement ${count}개 — 2단계 이상 권장`, reference: '§5.3', foundOn: bc.pagePath,
  }
}

// T-146: <time datetime="..."> 마크업 — Freshness 구조적 시그널 (§4.2 보완).
function checkTimeMarkup(homeHtml: string, detailHtml?: string): CheckResult {
  const scan = (html: string) => /<time[^>]+datetime=["'][^"']+["']/i.test(html)
  const homeHas = scan(homeHtml)
  const detailHas = detailHtml ? scan(detailHtml) : false
  if (homeHas || detailHas) return {
    id: 'time_markup', label: '<time datetime> 마크업', category: 'aeo',
    status: 'pass', points: WEIGHTS.time_markup, maxPoints: WEIGHTS.time_markup,
    detail: `${homeHas ? '홈' : '상세'} 페이지에서 발견`, reference: '§4.2',
  }
  return {
    id: 'time_markup', label: '<time datetime> 마크업', category: 'aeo',
    status: 'fail', points: 0, maxPoints: WEIGHTS.time_markup,
    detail: '<time datetime="..."> 태그 없음 — Freshness 구조 시그널 부재', reference: '§4.2',
  }
}

// T-146: Author/Person schema — E-E-A-T §4.1 (+40% 인용률).
function checkAuthorPersonSchema(allNodes: NodeWithSource[]): CheckResult {
  let found: NodeWithSource | null = null
  let hasCredentials = false
  for (const ns of allNodes) {
    const ts = typesOf(ns.node)
    if (ts.some(t => /^Person$/i.test(t))) { found = ns; break }
    // Article.author / WebPage.author 중 Person 타입인 경우
    const author = ns.node.author as Record<string, unknown> | undefined
    if (author && typeof author === 'object') {
      const aTypes = typesOf(author)
      if (aTypes.some(t => /Person/i.test(t)) && author.name) {
        found = { node: author, pageUrl: ns.pageUrl, pagePath: ns.pagePath }
        if (author.jobTitle || author.alumniOf || author.description || author.url) hasCredentials = true
        break
      }
    }
  }
  if (!found) return {
    id: 'author_person_schema', label: 'Author · Person schema (E-E-A-T)', category: 'aeo',
    status: 'fail', points: 0, maxPoints: WEIGHTS.author_person_schema,
    detail: '저자 Person schema 없음 — E-E-A-T 신호 부재 (§4.1)', reference: '§4.1',
  }
  if (hasCredentials) return {
    id: 'author_person_schema', label: 'Author · Person schema (E-E-A-T)', category: 'aeo',
    status: 'pass', points: WEIGHTS.author_person_schema, maxPoints: WEIGHTS.author_person_schema,
    detail: `저자 ${String(found.node.name ?? '')} · 자격 정보 포함`, reference: '§4.1', foundOn: found.pagePath,
  }
  return {
    id: 'author_person_schema', label: 'Author · Person schema (E-E-A-T)', category: 'aeo',
    status: 'warn', points: Math.round(WEIGHTS.author_person_schema * 0.6), maxPoints: WEIGHTS.author_person_schema,
    detail: '저자 이름은 있으나 jobTitle/url/description 중 하나도 없음 — 자격 정보 보강 필요', reference: '§4.1', foundOn: found.pagePath,
  }
}

function analyzeDirectAnswer(html: string, tagLabel: string): { good: number; warn: number; total: number; tag: string } {
  const h2Matches = [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>([\s\S]*?)(?=<h2|<h1|<\/body>|$)/gi)]
  const total = Math.min(h2Matches.length, 5)
  let good = 0, warn = 0
  for (let i = 0; i < total; i++) {
    const body = h2Matches[i][2] ?? ''
    const firstP = body.match(/<p[^>]*>([\s\S]*?)<\/p>/i)
    const text = (firstP?.[1] ?? body).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
    const w = displayWidth(text)
    if (w >= 40 && w <= 120) good += 1
    else if (w >= 20 && w <= 200) warn += 1
  }
  return { good, warn, total, tag: tagLabel }
}

function checkDirectAnswerBlock(homeHtml: string, detailHtml?: string): CheckResult {
  // 홈페이지 + (있으면) 샘플 상세 페이지 — 둘 중 나은 쪽을 반영
  const home = analyzeDirectAnswer(homeHtml, '홈')
  const detail = detailHtml ? analyzeDirectAnswer(detailHtml, '상세') : null
  const pick = detail && detail.total > home.total ? detail : home
  const { good, warn, total } = pick

  if (total === 0) return {
    id: 'direct_answer_block', label: 'Direct Answer Block', category: 'aeo',
    status: 'fail', points: 0, maxPoints: WEIGHTS.direct_answer_block,
    detail: 'H2 태그 없음 (홈' + (detail ? `·상세` : '') + ') — AEO 구조 부재', reference: '§4.4',
  }
  const ratio = good / total
  if (ratio >= 0.6) return {
    id: 'direct_answer_block', label: 'Direct Answer Block', category: 'aeo',
    status: 'pass', points: WEIGHTS.direct_answer_block, maxPoints: WEIGHTS.direct_answer_block,
    detail: `${pick.tag} H2 ${total}개 중 ${good}개가 40~120폭 자기완결 답변`, reference: '§4.4',
  }
  if (good + warn >= Math.ceil(total / 2)) return {
    id: 'direct_answer_block', label: 'Direct Answer Block', category: 'aeo',
    status: 'warn', points: Math.round(WEIGHTS.direct_answer_block * 0.6), maxPoints: WEIGHTS.direct_answer_block,
    detail: `${pick.tag} H2 직하 답변 부분 존재 (${good}/${total} 최적, ${warn} 부분)`, reference: '§4.4',
  }
  return {
    id: 'direct_answer_block', label: 'Direct Answer Block', category: 'aeo',
    status: 'fail', points: Math.round(WEIGHTS.direct_answer_block * 0.2), maxPoints: WEIGHTS.direct_answer_block,
    detail: 'H2 직하 40~60자 자기완결 답변 단락 부재 — AEO 기여 낮음', reference: '§4.4',
  }
}

function checkSameAs(allNodes: NodeWithSource[]): CheckResult {
  const urls = new Set<string>()
  let foundOn: string | undefined
  for (const ns of allNodes) {
    const sa = ns.node.sameAs
    if (!sa) continue
    foundOn = foundOn ?? ns.pagePath
    const list = Array.isArray(sa) ? sa : [sa]
    for (const u of list) if (typeof u === 'string') urls.add(u)
  }
  // 브랜드 도메인 광범위 매칭 (단축 URL·하위 도메인 포함).
  const hasNaver = [...urls].some(u => /\bnaver\.com|\bnaver\.me|\bnate\.com/i.test(u))
  const hasKakao = [...urls].some(u => /\bkakao\.com|\bkakao\.map|kakaomap|\bdaum\.net/i.test(u))
  const hasGoogle = [...urls].some(u => /google\.com|goo\.gl|\bg\.page|maps\.google|business\.google/i.test(u))
  const hasOther = [...urls].some(u => !/naver|kakao|google|g\.page|goo\.gl|nate|daum/i.test(u))
  const score = [hasNaver, hasKakao, hasGoogle, hasOther].filter(Boolean).length

  if (urls.size === 0) return {
    id: 'sameas_entity_linking', label: 'sameAs 엔티티 링크', category: 'aeo',
    status: 'fail', points: 0, maxPoints: WEIGHTS.sameas_entity_linking,
    detail: 'sameAs 속성 없음 — Knowledge Graph 엔티티 연결 불가', reference: '§5.3',
  }
  if (score >= 3) return {
    id: 'sameas_entity_linking', label: 'sameAs 엔티티 링크', category: 'aeo',
    status: 'pass', points: WEIGHTS.sameas_entity_linking, maxPoints: WEIGHTS.sameas_entity_linking,
    detail: `외부 프로필 ${urls.size}개 연결 (naver=${hasNaver ? '✓' : '✗'}, kakao=${hasKakao ? '✓' : '✗'}, google=${hasGoogle ? '✓' : '✗'})`,
    reference: '§5.3', foundOn,
  }
  return {
    id: 'sameas_entity_linking', label: 'sameAs 엔티티 링크', category: 'aeo',
    status: 'warn', points: Math.round(WEIGHTS.sameas_entity_linking * 0.5), maxPoints: WEIGHTS.sameas_entity_linking,
    detail: `sameAs ${urls.size}개 — 네이버·카카오·구글 3종 권장`, reference: '§5.3', foundOn,
  }
}

function checkLastUpdated(homeHtml: string, allNodes: NodeWithSource[]): CheckResult {
  let iso: string | null = null
  for (const ns of allNodes) {
    const candidate = (ns.node.dateModified ?? ns.node.datePublished) as unknown
    if (typeof candidate === 'string') { iso = candidate; break }
  }
  if (!iso) {
    const txt = homeHtml.replace(/<[^>]+>/g, ' ')
    const m = txt.match(/(?:Last\s*Updated|최종\s*업데이트|업데이트|수정)\s*[:\-–]?\s*(\d{4}[-./]\d{1,2}[-./]\d{1,2})/i)
    if (m) iso = m[1].replace(/\./g, '-').replace(/\//g, '-')
  }

  if (!iso) return {
    id: 'last_updated', label: '최종 업데이트 타임스탬프', category: 'aeo',
    status: 'fail', points: 0, maxPoints: WEIGHTS.last_updated,
    detail: 'dateModified·Last Updated 부재 — Freshness 시그널 없음', reference: '§4.2',
  }
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return {
    id: 'last_updated', label: '최종 업데이트 타임스탬프', category: 'aeo',
    status: 'warn', points: Math.round(WEIGHTS.last_updated * 0.5), maxPoints: WEIGHTS.last_updated,
    detail: `타임스탬프 파싱 실패: ${iso}`, reference: '§4.2',
  }
  const days = Math.floor((Date.now() - d.getTime()) / (24 * 60 * 60 * 1000))
  if (days <= 90) return {
    id: 'last_updated', label: '최종 업데이트 타임스탬프', category: 'aeo',
    status: 'pass', points: WEIGHTS.last_updated, maxPoints: WEIGHTS.last_updated,
    detail: `${days}일 전 갱신 — ChatGPT 2.3배 가중 범위 (90일 이내)`, reference: '§4.2',
  }
  if (days <= 365) return {
    id: 'last_updated', label: '최종 업데이트 타임스탬프', category: 'aeo',
    status: 'warn', points: Math.round(WEIGHTS.last_updated * 0.6), maxPoints: WEIGHTS.last_updated,
    detail: `${days}일 전 — 분기별 갱신 권장 (§4.2)`, reference: '§4.2',
  }
  return {
    id: 'last_updated', label: '최종 업데이트 타임스탬프', category: 'aeo',
    status: 'warn', points: Math.round(WEIGHTS.last_updated * 0.3), maxPoints: WEIGHTS.last_updated,
    detail: `${days}일 전 — 1년 이상 방치, Freshness 감점`, reference: '§4.2',
  }
}

function titleRange(w: number) { return { min: 30, max: 70, warnMin: 20, warnMax: 90, w } }
function descRange(w: number) { return { min: 80, max: 180, warnMin: 50, warnMax: 220, w } }

function checkTitle(html: string): CheckResult {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  const title = m?.[1]?.trim() ?? ''
  if (!title) return { id: 'title', label: '페이지 제목', category: 'seo', status: 'fail', points: 0, maxPoints: WEIGHTS.title, detail: '<title> 태그 없음' }
  const w = displayWidth(title); const r = titleRange(w)
  if (w >= r.min && w <= r.max) return { id: 'title', label: '페이지 제목', category: 'seo', status: 'pass', points: WEIGHTS.title, maxPoints: WEIGHTS.title, detail: `"${title}" (${title.length}자, 표시폭 ${w})` }
  if (w >= r.warnMin && w <= r.warnMax) return { id: 'title', label: '페이지 제목', category: 'seo', status: 'warn', points: Math.round(WEIGHTS.title * 0.7), maxPoints: WEIGHTS.title, detail: `"${title}" (표시폭 ${w}/권장 ${r.min}~${r.max})` }
  return { id: 'title', label: '페이지 제목', category: 'seo', status: 'warn', points: Math.round(WEIGHTS.title / 2), maxPoints: WEIGHTS.title, detail: `"${title}" (표시폭 ${w} — 검색결과 잘릴 위험)` }
}

function checkMetaDescription(html: string): CheckResult {
  const m = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)
  const desc = m?.[1]?.trim() ?? ''
  if (!desc) return { id: 'meta_description', label: '메타 설명', category: 'seo', status: 'fail', points: 0, maxPoints: WEIGHTS.meta_description, detail: 'meta description 없음' }
  const w = displayWidth(desc); const r = descRange(w)
  if (w >= r.min && w <= r.max) return { id: 'meta_description', label: '메타 설명', category: 'seo', status: 'pass', points: WEIGHTS.meta_description, maxPoints: WEIGHTS.meta_description, detail: `${desc.length}자, 표시폭 ${w}` }
  if (w >= r.warnMin && w <= r.warnMax) return { id: 'meta_description', label: '메타 설명', category: 'seo', status: 'warn', points: Math.round(WEIGHTS.meta_description * 0.7), maxPoints: WEIGHTS.meta_description, detail: `표시폭 ${w}/권장 ${r.min}~${r.max}` }
  return { id: 'meta_description', label: '메타 설명', category: 'seo', status: 'warn', points: Math.round(WEIGHTS.meta_description / 2), maxPoints: WEIGHTS.meta_description, detail: `표시폭 ${w} — 권장 ${r.min}~${r.max}` }
}

function checkViewport(html: string): CheckResult {
  const pass = /<meta[^>]*name=["']viewport["']/i.test(html)
  return {
    id: 'viewport', label: '모바일 Viewport', category: 'seo',
    status: pass ? 'pass' : 'fail',
    points: pass ? WEIGHTS.viewport : 0, maxPoints: WEIGHTS.viewport,
    detail: pass ? '모바일 친화적' : 'viewport meta 없음',
  }
}

async function checkLlmsTxt(origin: string): Promise<CheckResult> {
  try {
    const res = await fetchWithTimeout(`${origin}/llms.txt`)
    if (res.ok) return { id: 'llms_txt', label: 'llms.txt', category: 'seo', status: 'pass', points: WEIGHTS.llms_txt, maxPoints: WEIGHTS.llms_txt, detail: 'llms.txt 존재 — 저비용 보너스 (§5.2)', reference: '§5.2' }
    return { id: 'llms_txt', label: 'llms.txt', category: 'seo', status: 'warn', points: 0, maxPoints: WEIGHTS.llms_txt, detail: 'llms.txt 없음 (비공식 표준, 가산점 대상)', reference: '§5.2' }
  } catch {
    return { id: 'llms_txt', label: 'llms.txt', category: 'seo', status: 'warn', points: 0, maxPoints: WEIGHTS.llms_txt, detail: 'llms.txt 조회 실패', reference: '§5.2' }
  }
}

// ---------- 메인 ----------

export async function scanSite(rawUrl: string): Promise<ScanResult> {
  const parsed = normalizeUrl(rawUrl)
  if (!parsed) {
    return { url: rawUrl, fetchedAt: new Date().toISOString(), score: 0, checks: [], error: 'URL 형식이 올바르지 않습니다', pagesScanned: 0, sitemapPresent: false }
  }
  const homeUrl = parsed.toString()
  const origin = `${parsed.protocol}//${parsed.host}`

  // 홈페이지 fetch + 사이트맵 조사 병렬
  const [homeScan, sitemapInfo, robotsCheck, llmsCheck] = await Promise.all([
    scanPage(homeUrl),
    sampleSitemapUrls(origin, homeUrl),
    checkRobotsAiAllow(origin),
    checkLlmsTxt(origin),
  ])

  if (!homeScan) {
    return {
      url: homeUrl, fetchedAt: new Date().toISOString(), score: 0, checks: [],
      error: '홈페이지 fetch 실패 — URL 확인 필요', pagesScanned: 0, sitemapPresent: sitemapInfo.present,
    }
  }

  // 추가 페이지 배치 스캔 (사이트맵 있을 때만)
  const extraPages = await scanPagesBatched(sitemapInfo.urls, FETCH_CONCURRENCY)
  const allPages = [homeScan, ...extraPages]
  const allNodes = allPages.flatMap(p => p.nodes)
  const detailHtml = extraPages[0]?.html

  const sitemapCheck: CheckResult = sitemapInfo.present
    ? {
        id: 'sitemap', label: 'sitemap.xml', category: 'seo',
        status: 'pass', points: WEIGHTS.sitemap, maxPoints: WEIGHTS.sitemap,
        detail: `sitemap.xml 존재 · ${allPages.length}개 고유 경로 스캔 (홈 + ${extraPages.length} route pattern)`,
      }
    : {
        id: 'sitemap', label: 'sitemap.xml', category: 'seo',
        status: 'fail', points: 0, maxPoints: WEIGHTS.sitemap,
        detail: 'sitemap.xml 없음 — AI 크롤러가 상세 페이지를 발견할 수 없습니다 (현재 진단은 홈페이지 한정)',
      }

  const checks: CheckResult[] = [
    // GEO 핵심 스키마
    checkJsonLdLocalBusiness(allNodes),
    robotsCheck,
    checkFaqSchema(allNodes),
    checkReviewSchema(allNodes),
    checkBreadcrumbSchema(allNodes),            // T-146
    // AEO
    checkDirectAnswerBlock(homeScan.html, detailHtml),
    checkSameAs(allNodes),
    checkLastUpdated(homeScan.html, allNodes),
    checkTimeMarkup(homeScan.html, detailHtml), // T-146
    checkAuthorPersonSchema(allNodes),          // T-146
    // SEO 기초
    checkTitle(homeScan.html),
    checkMetaDescription(homeScan.html),
    sitemapCheck,
    llmsCheck,
    checkHttps(parsed),
    checkViewport(homeScan.html),
  ]

  const score = checks.reduce((s, c) => s + c.points, 0)
  return {
    url: homeUrl,
    fetchedAt: new Date().toISOString(),
    score,
    checks,
    pagesScanned: allPages.length,
    sitemapPresent: sitemapInfo.present,
    sampledPages: allPages.map(p => p.path),
  }
}
