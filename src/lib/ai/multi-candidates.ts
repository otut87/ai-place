// 다중 후보 LLM 결과 병합·랭킹·큐레이션 (T-052)
// - description: 품질 스코어 기준 상위 N개 + 유사 중복 제거
// - services   : 이름 기준 dedup + 카테고리/가격 신호로 순위
// - faqs       : 질문 기준 dedup + 수치·길이 신호로 순위
// - tags       : 등장 빈도 기준 순위
//
// 어드민이 여러 후보를 카드 형태로 보고 직접 선택하는 것을 전제로 한다.

import { scoreQuality } from '@/lib/ai/quality-score'

export interface ServiceItem {
  name: string
  description?: string
  priceRange?: string
}
export interface FaqItem {
  question: string
  answer: string
}
export interface ContentCandidate {
  description: string
  services: ServiceItem[]
  faqs: FaqItem[]
  tags: string[]
}

export interface RankContext {
  businessName: string
  city?: string
  categoryKeyword?: string
}

export interface DescriptionCandidate {
  text: string
  score: number
}

export interface CandidatePool {
  descriptions: DescriptionCandidate[]
  services: ServiceItem[]
  faqs: FaqItem[]
  tags: string[]
}

export interface BuildPoolOptions {
  descriptionTop?: number
  serviceMax?: number
  faqMax?: number
  tagMax?: number
}

const DEFAULT_DESC_TOP = 3
const DEFAULT_SERVICE_MAX = 7
const DEFAULT_FAQ_MAX = 5
const DEFAULT_TAG_MAX = 8

const NUMERIC_RE = /\d/

/** 중복 판별용 정규화 — 공백·구두점·대소문자 제거. */
export function normalizeForDedup(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[\p{P}\p{S}]+/gu, '')
}

function uniqueByKey<T>(items: T[], keyFn: (item: T) => string): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const it of items) {
    const key = keyFn(it)
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(it)
  }
  return out
}

/** description 후보 리스트를 품질 스코어로 정렬(고→저) + 유사 중복 제거. */
export function rankDescriptionCandidates(
  candidates: string[],
  ctx: RankContext,
  sharedContent: { services: ServiceItem[]; faqs: FaqItem[]; tags: string[] },
): DescriptionCandidate[] {
  if (candidates.length === 0) return []

  const scored: DescriptionCandidate[] = candidates.map(text => {
    const score = scoreQuality({
      businessName: ctx.businessName,
      city: ctx.city,
      categoryKeyword: ctx.categoryKeyword,
      description: text,
      services: sharedContent.services,
      faqs: sharedContent.faqs,
      tags: sharedContent.tags,
    }).score
    return { text, score }
  })

  scored.sort((a, b) => b.score - a.score)

  return uniqueByKey(scored, d => normalizeForDedup(d.text))
}

function serviceRankScore(svc: ServiceItem, ctx: RankContext): number {
  let s = 0
  if (svc.priceRange && NUMERIC_RE.test(svc.priceRange)) s += 10
  if (svc.description && svc.description.length > 0) s += 3
  if (ctx.categoryKeyword) {
    const blob = `${svc.name} ${svc.description ?? ''}`
    if (blob.includes(ctx.categoryKeyword)) s += 8
    else {
      // 2자 이상 겹치면 부분 점수
      for (let i = 0; i + 2 <= ctx.categoryKeyword.length; i += 1) {
        const chunk = ctx.categoryKeyword.slice(i, i + 2)
        if (blob.includes(chunk)) { s += 3; break }
      }
    }
  }
  return s
}

/** 여러 후보의 서비스를 이름 기준 dedup + 랭킹. 가격 있는 후보를 우선. */
export function mergeServicePool(
  candidates: ContentCandidate[],
  ctx: RankContext,
  opts: { max?: number } = {},
): ServiceItem[] {
  const max = opts.max ?? DEFAULT_SERVICE_MAX

  // name 정규화 → 같은 키의 첫 등장만 유지하되, 가격 있는 항목으로 보강.
  const byKey = new Map<string, ServiceItem>()
  for (const c of candidates) {
    for (const svc of c.services) {
      const key = normalizeForDedup(svc.name)
      if (!key) continue
      const prev = byKey.get(key)
      if (!prev) {
        byKey.set(key, { ...svc })
        continue
      }
      // 기존 항목의 빈 필드를 새 후보로 보강
      if ((!prev.priceRange || !NUMERIC_RE.test(prev.priceRange)) && svc.priceRange) {
        prev.priceRange = svc.priceRange
      }
      if ((!prev.description || prev.description.length === 0) && svc.description) {
        prev.description = svc.description
      }
    }
  }

  const merged = Array.from(byKey.values())
  merged.sort((a, b) => serviceRankScore(b, ctx) - serviceRankScore(a, ctx))
  return merged.slice(0, max)
}

function faqRankScore(f: FaqItem, ctx: RankContext): number {
  let s = 0
  if (NUMERIC_RE.test(f.answer)) s += 10
  if (f.answer.length >= 20) s += 3
  if (ctx.businessName && f.question.includes(ctx.businessName)) s += 4
  if (f.question.trim().endsWith('?')) s += 2
  return s
}

/** 여러 후보의 FAQ 를 질문 기준 dedup + 랭킹 + 최대 N개로 자름. */
export function mergeFaqPool(
  candidates: ContentCandidate[],
  ctx: RankContext,
  opts: { max?: number } = {},
): FaqItem[] {
  const max = opts.max ?? DEFAULT_FAQ_MAX

  const pool: FaqItem[] = []
  for (const c of candidates) pool.push(...c.faqs)

  const deduped = uniqueByKey(pool, f => normalizeForDedup(f.question))
  deduped.sort((a, b) => faqRankScore(b, ctx) - faqRankScore(a, ctx))
  return deduped.slice(0, max)
}

/** 태그 풀 — 등장 빈도 순 정렬 + 최대 N개. */
export function mergeTagPool(
  candidates: ContentCandidate[],
  opts: { max?: number } = {},
): string[] {
  const max = opts.max ?? DEFAULT_TAG_MAX

  const count = new Map<string, { original: string; n: number; firstIndex: number }>()
  let idx = 0
  for (const c of candidates) {
    for (const t of c.tags) {
      const raw = t.trim()
      if (!raw) continue
      const key = normalizeForDedup(raw)
      if (!key) continue
      const prev = count.get(key)
      if (prev) {
        prev.n += 1
      } else {
        count.set(key, { original: raw, n: 1, firstIndex: idx })
        idx += 1
      }
    }
  }

  return Array.from(count.values())
    .sort((a, b) => (b.n - a.n) || (a.firstIndex - b.firstIndex))
    .slice(0, max)
    .map(v => v.original)
}

/** 후보 여러 개를 어드민이 바로 큐레이션할 수 있는 풀로 병합. */
export function buildCandidatePool(
  candidates: ContentCandidate[],
  ctx: RankContext,
  opts: BuildPoolOptions = {},
): CandidatePool {
  const {
    descriptionTop = DEFAULT_DESC_TOP,
    serviceMax = DEFAULT_SERVICE_MAX,
    faqMax = DEFAULT_FAQ_MAX,
    tagMax = DEFAULT_TAG_MAX,
  } = opts

  if (candidates.length === 0) {
    return { descriptions: [], services: [], faqs: [], tags: [] }
  }

  const services = mergeServicePool(candidates, ctx, { max: serviceMax })
  const faqs = mergeFaqPool(candidates, ctx, { max: faqMax })
  const tags = mergeTagPool(candidates, { max: tagMax })
  const descriptions = rankDescriptionCandidates(
    candidates.map(c => c.description).filter(Boolean),
    ctx,
    { services, faqs, tags },
  ).slice(0, descriptionTop)

  return { descriptions, services, faqs, tags }
}
