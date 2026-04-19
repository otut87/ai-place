// T-137 — 홈페이지 기술 진단 로직.
// 무료·API 없음. HTTP fetch + regex 파싱으로 9개 체크 수행.
// 점수 합계 100점. 결과는 /check 페이지 표시 + T-141 Owner 대시보드에서 재사용.

export interface ScanResult {
  url: string
  fetchedAt: string
  score: number             // 0~100
  checks: CheckResult[]
  error?: string            // fetch 실패 시
}

export interface CheckResult {
  id: CheckId
  label: string
  status: 'pass' | 'warn' | 'fail'
  points: number            // 획득 점수
  maxPoints: number         // 항목 만점
  detail?: string           // 추가 설명
}

export type CheckId =
  | 'https'
  | 'title'
  | 'meta_description'
  | 'viewport'
  | 'og_tags'
  | 'jsonld_localbusiness'
  | 'robots_ai_allow'
  | 'sitemap'
  | 'llms_txt'

// 총 100점: 각 항목 가중치.
const WEIGHTS: Record<CheckId, number> = {
  jsonld_localbusiness: 25, // 가장 중요 — AI 가독성 핵심
  robots_ai_allow: 20,      // AI 크롤러 차단 방지
  meta_description: 10,
  og_tags: 10,
  title: 8,
  sitemap: 8,
  llms_txt: 7,
  https: 7,
  viewport: 5,
}

const FETCH_TIMEOUT_MS = 10_000
const USER_AGENT = 'AIPlaceDiagnostic/1.0 (+https://aiplace.kr/check)'

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

// --- 개별 체크 함수 (모두 regex 기반) ---

function checkHttps(url: URL): CheckResult {
  const pass = url.protocol === 'https:'
  return {
    id: 'https',
    label: 'HTTPS',
    status: pass ? 'pass' : 'fail',
    points: pass ? WEIGHTS.https : 0,
    maxPoints: WEIGHTS.https,
    detail: pass ? '안전한 HTTPS 연결' : 'HTTP 접속 — AI 크롤러가 신뢰하지 않을 수 있음',
  }
}

/**
 * 표시폭(display width) 계산 — 한글·CJK 는 2, Latin/숫자/공백은 1.
 * Google 검색결과가 픽셀 단위로 잘리므로 실제 가독성 기준은 "폭" 이 맞다.
 */
function displayWidth(text: string): number {
  let width = 0
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0
    // 한글·CJK 통합한자·일본어 가나 등 wide 문자
    if (
      (code >= 0xAC00 && code <= 0xD7A3) || // 한글 음절
      (code >= 0x4E00 && code <= 0x9FFF) || // CJK
      (code >= 0x3040 && code <= 0x30FF)    // 일본어
    ) {
      width += 2
    } else {
      width += 1
    }
  }
  return width
}

// 권장치는 Google 검색결과 픽셀 잘림 기준.
// title : 약 30~70 display units (짧은 것은 허용, 너무 긴 것만 경고)
// desc  : 약 80~200 display units (2줄 표시 영역)
function titleRange(text: string): { min: number; max: number; warnMin: number; warnMax: number; widthValue: number } {
  return { min: 30, max: 70, warnMin: 20, warnMax: 90, widthValue: displayWidth(text) }
}

function descRange(text: string): { min: number; max: number; warnMin: number; warnMax: number; widthValue: number } {
  return { min: 80, max: 180, warnMin: 50, warnMax: 220, widthValue: displayWidth(text) }
}

function checkTitle(html: string): CheckResult {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  const title = m?.[1]?.trim() ?? ''
  const chars = title.length
  const r = titleRange(title)
  const w = r.widthValue

  if (chars === 0) {
    return { id: 'title', label: '페이지 제목', status: 'fail', points: 0, maxPoints: WEIGHTS.title, detail: '<title> 태그 없음' }
  }
  if (w >= r.min && w <= r.max) {
    return { id: 'title', label: '페이지 제목', status: 'pass', points: WEIGHTS.title, maxPoints: WEIGHTS.title, detail: `"${title}" (${chars}자)` }
  }
  if (w >= r.warnMin && w <= r.warnMax) {
    return { id: 'title', label: '페이지 제목', status: 'warn', points: Math.round(WEIGHTS.title * 0.75), maxPoints: WEIGHTS.title, detail: `"${title}" (${chars}자, 검색결과 표시폭 ${w}/권장 ${r.min}~${r.max})` }
  }
  return { id: 'title', label: '페이지 제목', status: 'warn', points: Math.round(WEIGHTS.title / 2), maxPoints: WEIGHTS.title, detail: `"${title}" (${chars}자, 표시폭 ${w} — 검색결과에서 잘릴 수 있음)` }
}

function checkMetaDescription(html: string): CheckResult {
  const m = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)
  const desc = m?.[1]?.trim() ?? ''
  const chars = desc.length
  const r = descRange(desc)
  const w = r.widthValue

  if (chars === 0) {
    return { id: 'meta_description', label: '메타 설명', status: 'fail', points: 0, maxPoints: WEIGHTS.meta_description, detail: 'meta description 없음' }
  }
  if (w >= r.min && w <= r.max) {
    return { id: 'meta_description', label: '메타 설명', status: 'pass', points: WEIGHTS.meta_description, maxPoints: WEIGHTS.meta_description, detail: `${chars}자` }
  }
  if (w >= r.warnMin && w <= r.warnMax) {
    return { id: 'meta_description', label: '메타 설명', status: 'warn', points: Math.round(WEIGHTS.meta_description * 0.75), maxPoints: WEIGHTS.meta_description, detail: `${chars}자 (표시폭 ${w}/권장 ${r.min}~${r.max})` }
  }
  return { id: 'meta_description', label: '메타 설명', status: 'warn', points: Math.round(WEIGHTS.meta_description / 2), maxPoints: WEIGHTS.meta_description, detail: `${chars}자 (표시폭 ${w} — 권장 ${r.min}~${r.max})` }
}

function checkViewport(html: string): CheckResult {
  const m = html.match(/<meta[^>]*name=["']viewport["']/i)
  const pass = Boolean(m)
  return {
    id: 'viewport',
    label: '모바일 Viewport',
    status: pass ? 'pass' : 'fail',
    points: pass ? WEIGHTS.viewport : 0,
    maxPoints: WEIGHTS.viewport,
    detail: pass ? '모바일 친화적' : 'viewport meta 없음 — 모바일에서 불편',
  }
}

function checkOgTags(html: string): CheckResult {
  const hasTitle = /<meta[^>]*property=["']og:title["']/i.test(html)
  const hasDesc = /<meta[^>]*property=["']og:description["']/i.test(html)
  const hasImage = /<meta[^>]*property=["']og:image["']/i.test(html)
  const present = [hasTitle, hasDesc, hasImage].filter(Boolean).length
  let status: 'pass' | 'warn' | 'fail' = 'fail'
  let points = 0
  if (present === 3) { status = 'pass'; points = WEIGHTS.og_tags }
  else if (present >= 1) { status = 'warn'; points = Math.round(WEIGHTS.og_tags * (present / 3)) }
  return {
    id: 'og_tags',
    label: 'Open Graph 태그',
    status,
    points,
    maxPoints: WEIGHTS.og_tags,
    detail: `${present}/3 (title=${hasTitle ? '✓' : '✗'}, description=${hasDesc ? '✓' : '✗'}, image=${hasImage ? '✓' : '✗'})`,
  }
}

function checkJsonLdLocalBusiness(html: string): CheckResult {
  const matches = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
  let hasLocalBusiness = false
  let hasName = false, hasAddress = false, hasPhone = false, hasHours = false
  for (const m of matches) {
    try {
      const parsed = JSON.parse(m[1])
      const list = Array.isArray(parsed) ? parsed : [parsed]
      for (const item of list) {
        const graph = item['@graph'] ? [...(item['@graph'] as unknown[])] : [item]
        for (const node of graph) {
          const n = node as Record<string, unknown>
          const type = n['@type']
          const types = Array.isArray(type) ? type : [type]
          const isLB = types.some(t =>
            typeof t === 'string' && /LocalBusiness|MedicalClinic|Dentist|BeautySalon|Restaurant|ProfessionalService|Store/i.test(t),
          )
          if (isLB) {
            hasLocalBusiness = true
            if (n.name) hasName = true
            if (n.address) hasAddress = true
            if (n.telephone) hasPhone = true
            if (n.openingHoursSpecification || n.openingHours) hasHours = true
          }
        }
      }
    } catch {
      // 파싱 실패 — 다음 script 계속
    }
  }

  if (!hasLocalBusiness) {
    return {
      id: 'jsonld_localbusiness',
      label: 'JSON-LD LocalBusiness',
      status: 'fail',
      points: 0,
      maxPoints: WEIGHTS.jsonld_localbusiness,
      detail: 'AI 가 업체 정보를 구조적으로 읽을 수 없습니다 (가장 중요한 항목)',
    }
  }

  const fields = [hasName, hasAddress, hasPhone, hasHours].filter(Boolean).length
  const ratio = fields / 4
  const points = Math.round(WEIGHTS.jsonld_localbusiness * (0.5 + ratio * 0.5)) // 구조 존재 시 50% + 필드 완성도 50%
  return {
    id: 'jsonld_localbusiness',
    label: 'JSON-LD LocalBusiness',
    status: fields === 4 ? 'pass' : 'warn',
    points,
    maxPoints: WEIGHTS.jsonld_localbusiness,
    detail: `구조 존재. 필수 필드 ${fields}/4 (name=${hasName ? '✓' : '✗'}, address=${hasAddress ? '✓' : '✗'}, phone=${hasPhone ? '✓' : '✗'}, hours=${hasHours ? '✓' : '✗'})`,
  }
}

async function checkRobotsAiAllow(origin: string): Promise<CheckResult> {
  try {
    const res = await fetchWithTimeout(`${origin}/robots.txt`)
    if (!res.ok) {
      return { id: 'robots_ai_allow', label: 'robots.txt AI 크롤러 허용', status: 'warn', points: Math.round(WEIGHTS.robots_ai_allow * 0.6), maxPoints: WEIGHTS.robots_ai_allow, detail: `robots.txt 없음 (HTTP ${res.status}) — 기본 허용이지만 명시 권장` }
    }
    const txt = await res.text()
    const aiBots = ['GPTBot', 'ClaudeBot', 'PerplexityBot', 'CCBot', 'Google-Extended']
    const blocked: string[] = []
    for (const bot of aiBots) {
      // "User-agent: <bot>" 블록 내 Disallow: / 있으면 차단
      const re = new RegExp(`User-agent:\\s*${bot}[\\s\\S]*?(?=User-agent:|$)`, 'gi')
      const blockMatch = txt.match(re)
      if (blockMatch && /Disallow:\s*\/\s*$/m.test(blockMatch[0])) blocked.push(bot)
    }
    // Global Disallow: / 검사
    const globalBlocked = /User-agent:\s*\*[\s\S]*?Disallow:\s*\/\s*$/m.test(txt)
    if (globalBlocked) {
      return { id: 'robots_ai_allow', label: 'robots.txt AI 크롤러 허용', status: 'fail', points: 0, maxPoints: WEIGHTS.robots_ai_allow, detail: 'User-agent: * 에 Disallow: / — 모든 크롤러 차단' }
    }
    if (blocked.length > 0) {
      return { id: 'robots_ai_allow', label: 'robots.txt AI 크롤러 허용', status: 'fail', points: Math.round(WEIGHTS.robots_ai_allow * 0.3), maxPoints: WEIGHTS.robots_ai_allow, detail: `차단된 AI 크롤러: ${blocked.join(', ')}` }
    }
    return { id: 'robots_ai_allow', label: 'robots.txt AI 크롤러 허용', status: 'pass', points: WEIGHTS.robots_ai_allow, maxPoints: WEIGHTS.robots_ai_allow, detail: `${aiBots.join(', ')} 모두 접근 가능` }
  } catch (err) {
    return { id: 'robots_ai_allow', label: 'robots.txt AI 크롤러 허용', status: 'warn', points: Math.round(WEIGHTS.robots_ai_allow * 0.5), maxPoints: WEIGHTS.robots_ai_allow, detail: `조회 실패: ${err instanceof Error ? err.message : 'unknown'}` }
  }
}

async function checkSitemap(origin: string): Promise<CheckResult> {
  try {
    const res = await fetchWithTimeout(`${origin}/sitemap.xml`)
    if (res.ok) {
      return { id: 'sitemap', label: 'sitemap.xml', status: 'pass', points: WEIGHTS.sitemap, maxPoints: WEIGHTS.sitemap, detail: 'sitemap.xml 존재' }
    }
    return { id: 'sitemap', label: 'sitemap.xml', status: 'fail', points: 0, maxPoints: WEIGHTS.sitemap, detail: `HTTP ${res.status} — sitemap.xml 없음` }
  } catch (err) {
    return { id: 'sitemap', label: 'sitemap.xml', status: 'warn', points: 0, maxPoints: WEIGHTS.sitemap, detail: `조회 실패: ${err instanceof Error ? err.message : 'unknown'}` }
  }
}

async function checkLlmsTxt(origin: string): Promise<CheckResult> {
  try {
    const res = await fetchWithTimeout(`${origin}/llms.txt`)
    if (res.ok) {
      return { id: 'llms_txt', label: 'llms.txt', status: 'pass', points: WEIGHTS.llms_txt, maxPoints: WEIGHTS.llms_txt, detail: 'llms.txt 존재 — AI 우선 접근 안내' }
    }
    return { id: 'llms_txt', label: 'llms.txt', status: 'warn', points: 0, maxPoints: WEIGHTS.llms_txt, detail: 'llms.txt 없음 — AI 에게 핵심 정보 안내 부재' }
  } catch {
    return { id: 'llms_txt', label: 'llms.txt', status: 'warn', points: 0, maxPoints: WEIGHTS.llms_txt, detail: 'llms.txt 조회 실패' }
  }
}

/** 메인 스캔 진입점. 30초 내 완료 목표. */
export async function scanSite(rawUrl: string): Promise<ScanResult> {
  const parsed = normalizeUrl(rawUrl)
  if (!parsed) {
    return {
      url: rawUrl,
      fetchedAt: new Date().toISOString(),
      score: 0,
      checks: [],
      error: 'URL 형식이 올바르지 않습니다',
    }
  }

  let html = ''
  let fetchError: string | undefined
  try {
    const res = await fetchWithTimeout(parsed.toString())
    if (!res.ok) {
      fetchError = `HTTP ${res.status} ${res.statusText}`
    } else {
      html = await res.text()
    }
  } catch (err) {
    fetchError = err instanceof Error ? err.message : 'fetch failed'
  }

  if (fetchError) {
    return {
      url: parsed.toString(),
      fetchedAt: new Date().toISOString(),
      score: 0,
      checks: [],
      error: fetchError,
    }
  }

  const origin = `${parsed.protocol}//${parsed.host}`
  const checks: CheckResult[] = [
    checkHttps(parsed),
    checkTitle(html),
    checkMetaDescription(html),
    checkViewport(html),
    checkOgTags(html),
    checkJsonLdLocalBusiness(html),
    await checkRobotsAiAllow(origin),
    await checkSitemap(origin),
    await checkLlmsTxt(origin),
  ]

  const score = checks.reduce((s, c) => s + c.points, 0)
  return {
    url: parsed.toString(),
    fetchedAt: new Date().toISOString(),
    score,
    checks,
  }
}
