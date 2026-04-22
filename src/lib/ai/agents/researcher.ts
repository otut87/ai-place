// T-197 — Researcher 에이전트 (Phase 5).
//
// **비-LLM**. DB 에 이미 있는 필드를 구조화해서 ResearchPack 으로 반환.
// Writer 에이전트 프롬프트에 주입되어 "입력된 사실" 품질을 높인다.
//
// 원칙:
//  - 외부 API 호출 0 (비용 0).
//  - places 테이블의 미활용 필드(reviewSummaries, hoursBand, priceBands, channels, specialties)를 전부 활용.
//  - Place 타입 문서: src/lib/types.ts

import type { Place } from '@/lib/types'
import type { ResearchPack } from './writer'

function truncateStr(s: string | null | undefined, max: number): string | undefined {
  if (!s) return undefined
  const trimmed = s.trim()
  if (trimmed.length === 0) return undefined
  if (trimmed.length <= max) return trimmed
  return trimmed.slice(0, max - 1) + '…'
}

/** 평일/주말/주간 패턴을 한 줄로 요약. openingHours 는 ["Mo-Fr 09:00-18:00", ...] 형태. */
function summarizeHours(places: Place[]): string | undefined {
  const first = places.find(p => p.openingHours && p.openingHours.length > 0)
  if (!first || !first.openingHours) return undefined
  return truncateStr(first.openingHours.join(' / '), 180)
}

/** 서비스 가격대 상위 3~5개. priceRange 텍스트 필드만 추출. */
function extractPriceBands(places: Place[]): string[] {
  const bands: string[] = []
  for (const p of places) {
    for (const s of p.services ?? []) {
      if (s.priceRange && !bands.includes(s.priceRange)) {
        bands.push(`${s.name}: ${s.priceRange}`)
        if (bands.length >= 5) return bands
      }
    }
  }
  return bands
}

/** places[].reviewSummaries 에서 positiveThemes 상위를 뽑음 (T-191 저장분). */
function extractReviewHighlights(places: Place[]): string[] {
  const hl: string[] = []
  for (const p of places) {
    const summaries = (p as Place & { reviewSummaries?: Array<{
      positiveThemes?: string[]
      sampleQuote?: string
    }> }).reviewSummaries ?? []
    for (const s of summaries) {
      for (const theme of s.positiveThemes ?? []) {
        if (!hl.includes(theme)) hl.push(theme)
        if (hl.length >= 6) return hl
      }
    }
  }
  return hl
}

/** 채널 링크 대표 1곳 (첫 업체 기준). */
function extractChannels(places: Place[]): ResearchPack['channels'] {
  const first = places[0]
  if (!first) return {}
  const channels: ResearchPack['channels'] = {}
  if (first.naverPlaceUrl) channels.naver = first.naverPlaceUrl
  if (first.kakaoMapUrl) channels.kakao = first.kakaoMapUrl
  if (first.googleBusinessUrl) channels.google = first.googleBusinessUrl
  return channels
}

/** specialties — medicalSpecialty 혹은 services[].name 상위. */
function extractSpecialties(places: Place[]): string[] {
  const s = new Set<string>()
  for (const p of places) {
    // medicalSpecialty 타입에 없지만 Place extension 으로 들어올 수 있음
    const ms = (p as Place & { medicalSpecialty?: string | string[] }).medicalSpecialty
    if (Array.isArray(ms)) for (const x of ms) s.add(x)
    else if (typeof ms === 'string') s.add(ms)
    for (const srv of p.services ?? []) s.add(srv.name)
    if (s.size >= 6) break
  }
  return Array.from(s).slice(0, 6)
}

/** strengths — places[].strengths 합집합 상위 5. */
function extractStrengths(places: Place[]): string[] {
  const set = new Set<string>()
  for (const p of places) {
    for (const s of p.strengths ?? []) set.add(s)
    if (set.size >= 5) break
  }
  return Array.from(set).slice(0, 5)
}

/** recommendedFor — 합집합 상위 5. */
function extractRecommendedFor(places: Place[]): string[] {
  const set = new Set<string>()
  for (const p of places) {
    for (const r of p.recommendedFor ?? []) set.add(r)
    if (set.size >= 5) break
  }
  return Array.from(set).slice(0, 5)
}

/**
 * ResearchPack 생성 — Writer 프롬프트 자양분.
 * places 비어있으면 빈 pack (writer 가 external references 만으로 진행).
 */
export function buildResearchPack(places: Place[]): ResearchPack {
  return {
    reviewHighlights: extractReviewHighlights(places),
    hoursBand: summarizeHours(places),
    priceBands: extractPriceBands(places),
    channels: extractChannels(places),
    contact: places[0]?.phone,
    specialties: extractSpecialties(places),
    placeType: (places[0] as Place & { placeType?: string })?.placeType,
    recommendedFor: extractRecommendedFor(places),
    strengths: extractStrengths(places),
  }
}
