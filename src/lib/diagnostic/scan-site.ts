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
  reference?: string
  foundOn?: string          // schema 가 발견된 페이지 경로 (멀티 페이지 맥락)
}

export type CheckId =
  | 'jsonld_localbusiness'
  | 'robots_ai_allow'
  | 'faq_schema'
  | 'review_schema'
  | 'direct_answer_block'
  | 'sameas_entity_linking'
  | 'last_updated'
  | 'title'
  | 'meta_description'
  | 'sitemap'
  | 'llms_txt'
  | 'https'
  | 'viewport'

const WEIGHTS: Record<CheckId, number> = {
  jsonld_localbusiness: 20,
  robots_ai_allow: 15,
  faq_schema: 15,
  review_schema: 5,
  direct_answer_block: 10,
  sameas_entity_linking: 5,
  last_updated: 5,
  title: 5,
  meta_description: 5,
  sitemap: 8,          // v3: 5 → 8 (게이트키퍼 역할 반영)
  llms_txt: 2,
  https: 3,
  viewport: 2,
}

const FETCH_TIMEOUT_MS = 10_000
const MAX_SAMPLE_PAGES = 7        // 홈 포함 최대 8 페이지
const USER_AGENT = 'AIPlaceDiagnostic/3.0 (+https://aiplace.kr/check)'

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
    const res = await fetchWithTimeout(url)
    if (!res.ok) return null
    const html = await res.text()
    return { url, path: urlPath(url), html, nodes: collectJsonLdNodes(html, url) }
  } catch {
    return null
  }
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

  // 샘플링 전략: 깊이 기반 다양성 확보.
  // 디렉토리·이커머스 사이트는 **상세 페이지(depth ≥ 3)**에 LocalBusiness/Review/sameAs 가 집중됨.
  // 상세 페이지를 강제로 포함해야 스키마 집계가 의미 있음.
  const pathDepth = (u: string): number => urlPath(u).split('/').filter(Boolean).length
  const isFaq = (u: string) => /\/(faq|faqs|q-?and-?a|questions)(\/|$)/i.test(urlPath(u))
  const isAboutContact = (u: string) => /\/(about|contact|services?|info)(\/|$)/i.test(urlPath(u))
  const isReviewPath = (u: string) => /\/(review|testimonial)/i.test(urlPath(u))

  const all = [...urlSet]
  const faqUrls = all.filter(isFaq)
  const deepUrls = all.filter(u => !isFaq(u) && !isAboutContact(u) && pathDepth(u) >= 3).sort((a, b) => pathDepth(b) - pathDepth(a))
  const aboutUrls = all.filter(isAboutContact)
  const reviewUrls = all.filter(u => !isFaq(u) && !isAboutContact(u) && isReviewPath(u))
  const shallowUrls = all.filter(u => !isFaq(u) && !isAboutContact(u) && !isReviewPath(u) && pathDepth(u) < 3)

  const picked: string[] = []
  const take = (arr: string[], n: number) => {
    for (const u of arr) { if (picked.length >= limit || n <= 0) break; if (!picked.includes(u)) { picked.push(u); n -= 1 } }
  }
  // 쿼터: FAQ 1, 상세(deep) 3, about/contact 1, review 1, 샐로우 나머지
  take(faqUrls, 1)
  take(deepUrls, 3)
  take(aboutUrls, 1)
  take(reviewUrls, 1)
  take(shallowUrls, limit)      // 남은 자리 샐로우로 채우기
  take(deepUrls, limit)          // 그래도 남으면 더 많은 상세

  return { present: true, urls: picked.slice(0, limit) }
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

  if (hasAggregate && hasReview) return {
    id: 'review_schema', label: 'Review · AggregateRating schema', category: 'geo',
    status: 'pass', points: WEIGHTS.review_schema, maxPoints: WEIGHTS.review_schema,
    detail: `평점 ${ratingValue ?? '?'}/5 · 리뷰 ${reviewCount ?? '?'}개 — ChatGPT 리뷰 선호 신호`,
    reference: '§3.1', foundOn,
  }
  if (hasAggregate || hasReview) return {
    id: 'review_schema', label: 'Review · AggregateRating schema', category: 'geo',
    status: 'warn', points: Math.round(WEIGHTS.review_schema * 0.5), maxPoints: WEIGHTS.review_schema,
    detail: hasAggregate ? 'AggregateRating만 있음 — 개별 Review도 권장' : 'Review만 있음 — AggregateRating도 권장',
    reference: '§3.1', foundOn,
  }
  return {
    id: 'review_schema', label: 'Review · AggregateRating schema', category: 'geo',
    status: 'fail', points: 0, maxPoints: WEIGHTS.review_schema,
    detail: '리뷰·평점 schema 없음 (샘플 페이지 전체 검사)', reference: '§3.1',
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
  const hasNaver = [...urls].some(u => /naver\.com|map\.naver|place\.map\.naver/i.test(u))
  const hasKakao = [...urls].some(u => /kakao|place\.map\.kakao/i.test(u))
  const hasGoogle = [...urls].some(u => /google\.com\/(maps|search)|g\.page/i.test(u))
  const hasOther = [...urls].some(u => !/naver|kakao|google|g\.page/i.test(u))
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

  // 추가 페이지 병렬 스캔 (사이트맵 있을 때만)
  const additionalScans = await Promise.all(sitemapInfo.urls.map(scanPage))
  const extraPages = additionalScans.filter((p): p is PageScan => p !== null)
  const allPages = [homeScan, ...extraPages]
  const allNodes = allPages.flatMap(p => p.nodes)
  const detailHtml = extraPages[0]?.html

  const sitemapCheck: CheckResult = sitemapInfo.present
    ? {
        id: 'sitemap', label: 'sitemap.xml', category: 'seo',
        status: 'pass', points: WEIGHTS.sitemap, maxPoints: WEIGHTS.sitemap,
        detail: `sitemap.xml 존재 · ${allPages.length}개 페이지 스캔 (홈 + ${extraPages.length} 샘플)`,
      }
    : {
        id: 'sitemap', label: 'sitemap.xml', category: 'seo',
        status: 'fail', points: 0, maxPoints: WEIGHTS.sitemap,
        detail: 'sitemap.xml 없음 — AI 크롤러가 상세 페이지를 발견할 수 없습니다 (현재 진단은 홈페이지 한정)',
      }

  const checks: CheckResult[] = [
    checkJsonLdLocalBusiness(allNodes),
    robotsCheck,
    checkFaqSchema(allNodes),
    checkReviewSchema(allNodes),
    checkDirectAnswerBlock(homeScan.html, detailHtml),
    checkSameAs(allNodes),
    checkLastUpdated(homeScan.html, allNodes),
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
