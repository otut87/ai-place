// T-137 v2 — 홈페이지 AI 검색 인용 진단 (docs/GEO-SEO-AEO-딥리서치.md 기반 재설계).
// 설계 근거: Princeton GEO 논문 + BrightEdge·SeoClarity·Otterly 연구.
// 기초 SEO 레이어만 보던 v1 → GEO 핵심 레버(FAQPage·Review·sameAs·Direct Answer·Freshness) 추가.
//
// 점수 가중치 (총 100):
//   GEO 핵심 (문서 §4~5):           55점
//     - jsonld_localbusiness        20  (§5.3 — subtype 구체성 포함)
//     - robots_ai_allow             15  (§5.1 — GPTBot/ClaudeBot/PerplexityBot/Claude-User/Claude-SearchBot)
//     - faq_schema                  15  (§4.3 — 2.7~3.2배 인용률 단일 최고 ROI 레버)
//     - review_schema                5  (§3.1, §10 — ChatGPT 리뷰 플랫폼 선호)
//   AEO/E-E-A-T (문서 §4):         20점
//     - direct_answer_block         10  (§4.4 — 단일 레버 최대 기여)
//     - sameas_entity_linking        5  (§5.3 — Knowledge Graph 엔티티)
//     - last_updated                 5  (§4.2 — ChatGPT 2.3배, Perplexity 최우선)
//   기초 SEO:                      25점
//     - title                        5
//     - meta_description             5
//     - sitemap                      5
//     - llms_txt                     3  (§5.2 — "저비용 보너스"로 격하)
//     - https                        4
//     - viewport                     3

export interface ScanResult {
  url: string
  fetchedAt: string
  score: number
  checks: CheckResult[]
  error?: string
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
  sitemap: 5,
  llms_txt: 3,
  https: 4,
  viewport: 3,
}

const FETCH_TIMEOUT_MS = 10_000
const USER_AGENT = 'AIPlaceDiagnostic/2.0 (+https://aiplace.kr/check)'

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

/** 한글·CJK=2, Latin=1. Google 검색결과 픽셀 잘림 기준. */
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

/** JSON-LD 전체 노드 수집 (@graph 포함). */
function collectJsonLdNodes(html: string): Record<string, unknown>[] {
  const nodes: Record<string, unknown>[] = []
  const matches = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
  for (const m of matches) {
    try {
      const parsed = JSON.parse(m[1])
      const list = Array.isArray(parsed) ? parsed : [parsed]
      for (const item of list) {
        const rec = item as Record<string, unknown>
        if (Array.isArray(rec['@graph'])) {
          for (const g of rec['@graph'] as unknown[]) nodes.push(g as Record<string, unknown>)
        } else {
          nodes.push(rec)
        }
      }
    } catch {
      /* skip broken json-ld */
    }
  }
  return nodes
}

function typesOf(node: Record<string, unknown>): string[] {
  const t = node['@type']
  if (!t) return []
  return (Array.isArray(t) ? t : [t]).filter((x): x is string => typeof x === 'string')
}

// ---------------- GEO 핵심 체크 ----------------

function checkHttps(url: URL): CheckResult {
  const pass = url.protocol === 'https:'
  return {
    id: 'https', label: 'HTTPS', category: 'seo',
    status: pass ? 'pass' : 'fail',
    points: pass ? WEIGHTS.https : 0, maxPoints: WEIGHTS.https,
    detail: pass ? '안전한 HTTPS 연결' : 'HTTP — AI 크롤러 신뢰도 낮음',
  }
}

function checkJsonLdLocalBusiness(nodes: Record<string, unknown>[]): CheckResult {
  const SPECIFIC_RE = /Dentist|MedicalClinic|BeautySalon|HairSalon|Restaurant|Store|ProfessionalService|AutoBodyShop|ChildCare|EducationalOrganization|AccountingService|LegalService|VeterinaryCare|GasStation/i
  const GENERIC_RE = /^LocalBusiness$/i

  let best: { node: Record<string, unknown>; specific: boolean } | null = null
  for (const n of nodes) {
    const ts = typesOf(n)
    const hasSpecific = ts.some(t => SPECIFIC_RE.test(t))
    const hasGeneric = ts.some(t => GENERIC_RE.test(t) || /LocalBusiness/i.test(t))
    if (hasSpecific) { best = { node: n, specific: true }; break }
    if (hasGeneric && !best) best = { node: n, specific: false }
  }

  if (!best) {
    return {
      id: 'jsonld_localbusiness', label: 'JSON-LD LocalBusiness', category: 'geo',
      status: 'fail', points: 0, maxPoints: WEIGHTS.jsonld_localbusiness,
      detail: 'AI가 업체 정보를 구조적으로 읽을 수 없습니다 — 인용 진입 실패',
      reference: '§5.3',
    }
  }

  const n = best.node
  const hasName = Boolean(n.name)
  const hasAddress = Boolean(n.address)
  const hasPhone = Boolean(n.telephone)
  const hasHours = Boolean(n.openingHoursSpecification || n.openingHours)
  const fields = [hasName, hasAddress, hasPhone, hasHours].filter(Boolean).length

  // 구조 40% + 구체 subtype 20% + 필드 4종 40%
  const structureScore = 0.4
  const subtypeScore = best.specific ? 0.2 : 0
  const fieldScore = (fields / 4) * 0.4
  const points = Math.round(WEIGHTS.jsonld_localbusiness * (structureScore + subtypeScore + fieldScore))

  const full = best.specific && fields === 4
  return {
    id: 'jsonld_localbusiness', label: 'JSON-LD LocalBusiness', category: 'geo',
    status: full ? 'pass' : 'warn', points, maxPoints: WEIGHTS.jsonld_localbusiness,
    detail: `${best.specific ? `구체 subtype (${typesOf(n).join(',')})` : '일반 LocalBusiness — Dentist/Restaurant 등 구체화 권장'} · 필수필드 ${fields}/4 (name=${hasName ? '✓' : '✗'}, address=${hasAddress ? '✓' : '✗'}, phone=${hasPhone ? '✓' : '✗'}, hours=${hasHours ? '✓' : '✗'})`,
    reference: '§5.3',
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

function checkFaqSchema(nodes: Record<string, unknown>[]): CheckResult {
  let faqNode: Record<string, unknown> | null = null
  for (const n of nodes) {
    const ts = typesOf(n)
    if (ts.some(t => /FAQPage/i.test(t))) { faqNode = n; break }
  }
  if (!faqNode) {
    return {
      id: 'faq_schema', label: 'FAQPage schema', category: 'geo',
      status: 'fail', points: 0, maxPoints: WEIGHTS.faq_schema,
      detail: 'FAQPage 스키마 없음 — 문서 기준 인용률 2.7~3.2배 차이',
      reference: '§4.3',
    }
  }
  const mainEntity = faqNode.mainEntity
  const questions = Array.isArray(mainEntity) ? mainEntity : mainEntity ? [mainEntity] : []
  const count = questions.length
  if (count >= 5) {
    return {
      id: 'faq_schema', label: 'FAQPage schema', category: 'geo',
      status: 'pass', points: WEIGHTS.faq_schema, maxPoints: WEIGHTS.faq_schema,
      detail: `Q&A ${count}개 (권장 5개 이상)`, reference: '§4.3',
    }
  }
  if (count >= 3) {
    return {
      id: 'faq_schema', label: 'FAQPage schema', category: 'geo',
      status: 'warn', points: Math.round(WEIGHTS.faq_schema * 0.7), maxPoints: WEIGHTS.faq_schema,
      detail: `Q&A ${count}개 (권장 5개 이상)`, reference: '§4.3',
    }
  }
  return {
    id: 'faq_schema', label: 'FAQPage schema', category: 'geo',
    status: 'warn', points: Math.round(WEIGHTS.faq_schema * 0.4), maxPoints: WEIGHTS.faq_schema,
    detail: `FAQPage 존재하나 Q&A ${count}개 — 최소 5개 권장`, reference: '§4.3',
  }
}

function checkReviewSchema(nodes: Record<string, unknown>[]): CheckResult {
  let hasAggregate = false
  let hasReview = false
  let ratingValue: number | null = null
  let reviewCount: number | null = null

  for (const n of nodes) {
    const ar = n.aggregateRating as Record<string, unknown> | undefined
    if (ar && typeof ar === 'object') {
      hasAggregate = true
      const rv = Number(ar.ratingValue)
      const rc = Number(ar.reviewCount ?? ar.ratingCount)
      if (!Number.isNaN(rv)) ratingValue = rv
      if (!Number.isNaN(rc)) reviewCount = rc
    }
    if (n.review) hasReview = true
    if (typesOf(n).some(t => /^Review$/i.test(t))) hasReview = true
  }

  if (hasAggregate && hasReview) {
    return {
      id: 'review_schema', label: 'Review · AggregateRating schema', category: 'geo',
      status: 'pass', points: WEIGHTS.review_schema, maxPoints: WEIGHTS.review_schema,
      detail: `평점 ${ratingValue ?? '?'}/5 · 리뷰 ${reviewCount ?? '?'}개 — ChatGPT 리뷰 선호 신호`,
      reference: '§3.1',
    }
  }
  if (hasAggregate || hasReview) {
    return {
      id: 'review_schema', label: 'Review · AggregateRating schema', category: 'geo',
      status: 'warn', points: Math.round(WEIGHTS.review_schema * 0.5), maxPoints: WEIGHTS.review_schema,
      detail: hasAggregate ? 'AggregateRating만 있음 — 개별 Review도 권장' : 'Review만 있음 — AggregateRating도 권장',
      reference: '§3.1',
    }
  }
  return {
    id: 'review_schema', label: 'Review · AggregateRating schema', category: 'geo',
    status: 'fail', points: 0, maxPoints: WEIGHTS.review_schema,
    detail: '리뷰·평점 schema 없음', reference: '§3.1',
  }
}

// ---------------- AEO 체크 ----------------

function checkDirectAnswerBlock(html: string): CheckResult {
  // H2 태그 직하 첫 단락(40~60자 range 위주, 20~120 warn).
  // 간단 DOM 파싱: <h2>…</h2> 이후 첫 <p>…</p> 또는 텍스트.
  const h2Matches = [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>([\s\S]*?)(?=<h2|<h1|<\/body>|$)/gi)]
  if (h2Matches.length === 0) {
    return {
      id: 'direct_answer_block', label: 'Direct Answer Block', category: 'aeo',
      status: 'fail', points: 0, maxPoints: WEIGHTS.direct_answer_block,
      detail: 'H2 태그 없음 — AEO 구조 부재', reference: '§4.4',
    }
  }
  let goodCount = 0
  let warnCount = 0
  const checked = Math.min(h2Matches.length, 5)
  for (let i = 0; i < checked; i++) {
    const body = h2Matches[i][2] ?? ''
    const firstP = body.match(/<p[^>]*>([\s\S]*?)<\/p>/i)
    const text = (firstP?.[1] ?? body).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
    const w = displayWidth(text)
    if (w >= 40 && w <= 120) goodCount += 1
    else if (w >= 20 && w <= 200) warnCount += 1
  }
  const ratio = goodCount / checked
  if (ratio >= 0.6) {
    return {
      id: 'direct_answer_block', label: 'Direct Answer Block', category: 'aeo',
      status: 'pass', points: WEIGHTS.direct_answer_block, maxPoints: WEIGHTS.direct_answer_block,
      detail: `H2 ${checked}개 중 ${goodCount}개가 40~120폭 자기완결 답변`, reference: '§4.4',
    }
  }
  if (goodCount + warnCount >= Math.ceil(checked / 2)) {
    return {
      id: 'direct_answer_block', label: 'Direct Answer Block', category: 'aeo',
      status: 'warn', points: Math.round(WEIGHTS.direct_answer_block * 0.6), maxPoints: WEIGHTS.direct_answer_block,
      detail: `H2 직하 답변 단락 부분 존재 (${goodCount}/${checked} 최적, ${warnCount} 부분)`, reference: '§4.4',
    }
  }
  return {
    id: 'direct_answer_block', label: 'Direct Answer Block', category: 'aeo',
    status: 'fail', points: Math.round(WEIGHTS.direct_answer_block * 0.2), maxPoints: WEIGHTS.direct_answer_block,
    detail: 'H2 직하 40~60자 자기완결 답변 단락 부재 — AEO 기여 낮음', reference: '§4.4',
  }
}

function checkSameAs(nodes: Record<string, unknown>[]): CheckResult {
  const urls = new Set<string>()
  for (const n of nodes) {
    const sa = n.sameAs
    if (!sa) continue
    const list = Array.isArray(sa) ? sa : [sa]
    for (const u of list) if (typeof u === 'string') urls.add(u)
  }
  const hasNaver = [...urls].some(u => /naver\.com|map\.naver|place\.map\.naver/i.test(u))
  const hasKakao = [...urls].some(u => /kakao|place\.map\.kakao/i.test(u))
  const hasGoogle = [...urls].some(u => /google\.com\/(maps|search)|g\.page/i.test(u))
  const hasOther = [...urls].some(u => !/naver|kakao|google|g\.page/i.test(u))
  const score = [hasNaver, hasKakao, hasGoogle, hasOther].filter(Boolean).length

  if (urls.size === 0) {
    return {
      id: 'sameas_entity_linking', label: 'sameAs 엔티티 링크', category: 'aeo',
      status: 'fail', points: 0, maxPoints: WEIGHTS.sameas_entity_linking,
      detail: 'sameAs 속성 없음 — Knowledge Graph 엔티티 연결 불가', reference: '§5.3',
    }
  }
  if (score >= 3) {
    return {
      id: 'sameas_entity_linking', label: 'sameAs 엔티티 링크', category: 'aeo',
      status: 'pass', points: WEIGHTS.sameas_entity_linking, maxPoints: WEIGHTS.sameas_entity_linking,
      detail: `외부 프로필 ${urls.size}개 연결 (naver=${hasNaver ? '✓' : '✗'}, kakao=${hasKakao ? '✓' : '✗'}, google=${hasGoogle ? '✓' : '✗'})`,
      reference: '§5.3',
    }
  }
  return {
    id: 'sameas_entity_linking', label: 'sameAs 엔티티 링크', category: 'aeo',
    status: 'warn', points: Math.round(WEIGHTS.sameas_entity_linking * 0.5), maxPoints: WEIGHTS.sameas_entity_linking,
    detail: `sameAs ${urls.size}개 — 네이버·카카오·구글 3종 권장`, reference: '§5.3',
  }
}

function checkLastUpdated(html: string, nodes: Record<string, unknown>[]): CheckResult {
  // 1) JSON-LD dateModified/datePublished
  let iso: string | null = null
  for (const n of nodes) {
    const candidate = (n.dateModified ?? n.datePublished) as unknown
    if (typeof candidate === 'string') { iso = candidate; break }
  }
  // 2) 본문 "Last Updated" / "최종 업데이트" / 한국어 날짜 패턴
  if (!iso) {
    const txt = html.replace(/<[^>]+>/g, ' ')
    const m = txt.match(/(?:Last\s*Updated|최종\s*업데이트|업데이트|수정)\s*[:\-–]?\s*(\d{4}[-./]\d{1,2}[-./]\d{1,2})/i)
    if (m) iso = m[1].replace(/\./g, '-').replace(/\//g, '-')
  }

  if (!iso) {
    return {
      id: 'last_updated', label: '최종 업데이트 타임스탬프', category: 'aeo',
      status: 'fail', points: 0, maxPoints: WEIGHTS.last_updated,
      detail: 'dateModified·Last Updated 부재 — Freshness 시그널 없음', reference: '§4.2',
    }
  }
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) {
    return {
      id: 'last_updated', label: '최종 업데이트 타임스탬프', category: 'aeo',
      status: 'warn', points: Math.round(WEIGHTS.last_updated * 0.5), maxPoints: WEIGHTS.last_updated,
      detail: `타임스탬프 파싱 실패: ${iso}`, reference: '§4.2',
    }
  }
  const days = Math.floor((Date.now() - d.getTime()) / (24 * 60 * 60 * 1000))
  if (days <= 90) {
    return {
      id: 'last_updated', label: '최종 업데이트 타임스탬프', category: 'aeo',
      status: 'pass', points: WEIGHTS.last_updated, maxPoints: WEIGHTS.last_updated,
      detail: `${days}일 전 갱신 — ChatGPT 2.3배 가중 범위 (90일 이내)`, reference: '§4.2',
    }
  }
  if (days <= 365) {
    return {
      id: 'last_updated', label: '최종 업데이트 타임스탬프', category: 'aeo',
      status: 'warn', points: Math.round(WEIGHTS.last_updated * 0.6), maxPoints: WEIGHTS.last_updated,
      detail: `${days}일 전 — 분기별 갱신 권장 (§4.2)`, reference: '§4.2',
    }
  }
  return {
    id: 'last_updated', label: '최종 업데이트 타임스탬프', category: 'aeo',
    status: 'warn', points: Math.round(WEIGHTS.last_updated * 0.3), maxPoints: WEIGHTS.last_updated,
    detail: `${days}일 전 — 1년 이상 방치, Freshness 감점`, reference: '§4.2',
  }
}

// ---------------- 기초 SEO 체크 ----------------

function titleRange(w: number) { return { min: 30, max: 70, warnMin: 20, warnMax: 90, w } }
function descRange(w: number) { return { min: 80, max: 180, warnMin: 50, warnMax: 220, w } }

function checkTitle(html: string): CheckResult {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  const title = m?.[1]?.trim() ?? ''
  if (!title) return {
    id: 'title', label: '페이지 제목', category: 'seo',
    status: 'fail', points: 0, maxPoints: WEIGHTS.title, detail: '<title> 태그 없음',
  }
  const w = displayWidth(title); const r = titleRange(w)
  if (w >= r.min && w <= r.max) return {
    id: 'title', label: '페이지 제목', category: 'seo',
    status: 'pass', points: WEIGHTS.title, maxPoints: WEIGHTS.title,
    detail: `"${title}" (${title.length}자, 표시폭 ${w})`,
  }
  if (w >= r.warnMin && w <= r.warnMax) return {
    id: 'title', label: '페이지 제목', category: 'seo',
    status: 'warn', points: Math.round(WEIGHTS.title * 0.7), maxPoints: WEIGHTS.title,
    detail: `"${title}" (표시폭 ${w}/권장 ${r.min}~${r.max})`,
  }
  return {
    id: 'title', label: '페이지 제목', category: 'seo',
    status: 'warn', points: Math.round(WEIGHTS.title / 2), maxPoints: WEIGHTS.title,
    detail: `"${title}" (표시폭 ${w} — 검색결과 잘릴 위험)`,
  }
}

function checkMetaDescription(html: string): CheckResult {
  const m = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)
  const desc = m?.[1]?.trim() ?? ''
  if (!desc) return {
    id: 'meta_description', label: '메타 설명', category: 'seo',
    status: 'fail', points: 0, maxPoints: WEIGHTS.meta_description, detail: 'meta description 없음',
  }
  const w = displayWidth(desc); const r = descRange(w)
  if (w >= r.min && w <= r.max) return {
    id: 'meta_description', label: '메타 설명', category: 'seo',
    status: 'pass', points: WEIGHTS.meta_description, maxPoints: WEIGHTS.meta_description,
    detail: `${desc.length}자, 표시폭 ${w}`,
  }
  if (w >= r.warnMin && w <= r.warnMax) return {
    id: 'meta_description', label: '메타 설명', category: 'seo',
    status: 'warn', points: Math.round(WEIGHTS.meta_description * 0.7), maxPoints: WEIGHTS.meta_description,
    detail: `표시폭 ${w}/권장 ${r.min}~${r.max}`,
  }
  return {
    id: 'meta_description', label: '메타 설명', category: 'seo',
    status: 'warn', points: Math.round(WEIGHTS.meta_description / 2), maxPoints: WEIGHTS.meta_description,
    detail: `표시폭 ${w} — 권장 ${r.min}~${r.max}`,
  }
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

async function checkSitemap(origin: string): Promise<CheckResult> {
  try {
    const res = await fetchWithTimeout(`${origin}/sitemap.xml`)
    if (res.ok) return {
      id: 'sitemap', label: 'sitemap.xml', category: 'seo',
      status: 'pass', points: WEIGHTS.sitemap, maxPoints: WEIGHTS.sitemap,
      detail: 'sitemap.xml 존재',
    }
    return {
      id: 'sitemap', label: 'sitemap.xml', category: 'seo',
      status: 'fail', points: 0, maxPoints: WEIGHTS.sitemap,
      detail: `HTTP ${res.status} — sitemap.xml 없음`,
    }
  } catch (err) {
    return {
      id: 'sitemap', label: 'sitemap.xml', category: 'seo',
      status: 'warn', points: 0, maxPoints: WEIGHTS.sitemap,
      detail: `조회 실패: ${err instanceof Error ? err.message : 'unknown'}`,
    }
  }
}

async function checkLlmsTxt(origin: string): Promise<CheckResult> {
  try {
    const res = await fetchWithTimeout(`${origin}/llms.txt`)
    if (res.ok) return {
      id: 'llms_txt', label: 'llms.txt', category: 'seo',
      status: 'pass', points: WEIGHTS.llms_txt, maxPoints: WEIGHTS.llms_txt,
      detail: 'llms.txt 존재 — 저비용 보너스 (§5.2)', reference: '§5.2',
    }
    return {
      id: 'llms_txt', label: 'llms.txt', category: 'seo',
      status: 'warn', points: 0, maxPoints: WEIGHTS.llms_txt,
      detail: 'llms.txt 없음 (비공식 표준, 가산점 대상)', reference: '§5.2',
    }
  } catch {
    return {
      id: 'llms_txt', label: 'llms.txt', category: 'seo',
      status: 'warn', points: 0, maxPoints: WEIGHTS.llms_txt,
      detail: 'llms.txt 조회 실패', reference: '§5.2',
    }
  }
}

/** 메인 스캔 진입점. 30초 내 완료 목표. */
export async function scanSite(rawUrl: string): Promise<ScanResult> {
  const parsed = normalizeUrl(rawUrl)
  if (!parsed) {
    return { url: rawUrl, fetchedAt: new Date().toISOString(), score: 0, checks: [], error: 'URL 형식이 올바르지 않습니다' }
  }

  let html = ''
  let fetchError: string | undefined
  try {
    const res = await fetchWithTimeout(parsed.toString())
    if (!res.ok) fetchError = `HTTP ${res.status} ${res.statusText}`
    else html = await res.text()
  } catch (err) {
    fetchError = err instanceof Error ? err.message : 'fetch failed'
  }
  if (fetchError) {
    return { url: parsed.toString(), fetchedAt: new Date().toISOString(), score: 0, checks: [], error: fetchError }
  }

  const origin = `${parsed.protocol}//${parsed.host}`
  const nodes = collectJsonLdNodes(html)

  const checks: CheckResult[] = [
    // GEO 핵심
    checkJsonLdLocalBusiness(nodes),
    await checkRobotsAiAllow(origin),
    checkFaqSchema(nodes),
    checkReviewSchema(nodes),
    // AEO
    checkDirectAnswerBlock(html),
    checkSameAs(nodes),
    checkLastUpdated(html, nodes),
    // 기초 SEO
    checkTitle(html),
    checkMetaDescription(html),
    await checkSitemap(origin),
    await checkLlmsTxt(origin),
    checkHttps(parsed),
    checkViewport(html),
  ]

  const score = checks.reduce((s, c) => s + c.points, 0)
  return { url: parsed.toString(), fetchedAt: new Date().toISOString(), score, checks }
}
