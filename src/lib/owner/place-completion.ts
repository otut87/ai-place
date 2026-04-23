// T-219 — 업체 대시보드 "AI 가독성" 게이지 용 섹션별 완성도 계산.
// scorePlaceAeo 와 별개로, 편집 페이지 7개 섹션(기본/연락/서비스/FAQ/태그/사진/링크) 단위로 얼마나 채워졌는지 직관 표시.
// 오너 페르소나: "어느 섹션을 더 채워야 하나" 를 한 눈에 보기 위함.

import type { FAQ, PlaceImage, Service } from '@/lib/types'

export interface CompletionItem {
  /** "basic" | "contact" | "services" | "faq" | "tags" | "photos" | "links" */
  key: CompletionKey
  label: string
  score: number     // 0..max
  max: number
  /** good / warn / muted — 시각 분기. */
  level: 'good' | 'warn' | 'muted'
  /** 편집 페이지 앵커 경로. */
  href: string
  /** 개선 시 표시할 설명. */
  detail?: string
}

export type CompletionKey = 'basic' | 'contact' | 'services' | 'faq' | 'tags' | 'photos' | 'links'

export interface CompletionInput {
  placeId: string
  name: string
  address: string
  description: string | null
  nameEn: string | null
  phone: string | null
  openingHours: string[] | null
  tags: string[] | null
  recommendedFor: string[] | null
  strengths: string[] | null
  services: Service[] | null
  faqs: FAQ[] | null
  images: PlaceImage[] | null
  naverPlaceUrl: string | null
  kakaoMapUrl: string | null
  googleBusinessUrl: string | null
  homepageUrl: string | null
  blogUrl: string | null
  instagramUrl: string | null
}

function levelOf(score: number, max: number): 'good' | 'warn' | 'muted' {
  if (max === 0) return 'muted'
  const r = score / max
  if (r >= 0.9) return 'good'
  if (r >= 0.5) return 'warn'
  return 'muted'
}

export function calcCompletionItems(p: CompletionInput, baseHref: string): CompletionItem[] {
  // 1) 기본 정보 (name, address, description, name_en) — max 20
  //    필수 3개(name/address/description) 각 6점 + 선택 1개(name_en) 2점.
  let basic = 0
  if (p.name.trim()) basic += 6
  if (p.address.trim()) basic += 6
  const descLen = (p.description ?? '').trim().length
  if (descLen >= 40) basic += 6
  else if (descLen > 0) basic += 3
  if ((p.nameEn ?? '').trim()) basic += 2

  // 2) 연락 · 영업시간 — max 15 (전화 7, 영업시간 8)
  let contact = 0
  if ((p.phone ?? '').trim()) contact += 7
  const hoursN = (p.openingHours ?? []).filter((s) => s.trim()).length
  if (hoursN >= 5) contact += 8
  else if (hoursN >= 1) contact += Math.min(5, hoursN * 2)

  // 3) 제공 서비스 — max 20 (개수 10 + 가격 10)
  const services = (p.services ?? []).filter((s) => s.name && s.name.trim())
  const withPrice = services.filter((s) => s.priceRange && s.priceRange.trim()).length
  const svCount = Math.min(services.length, 5)
  const svScore = (svCount / 5) * 10
  const priceScore = services.length === 0 ? 0 : (withPrice / services.length) * 10
  const servicesScore = Math.round(svScore + priceScore)

  // 4) FAQ — max 15 (3개 이상 기준)
  const faqN = (p.faqs ?? []).filter((f) => f.question?.trim() && f.answer?.trim()).length
  const faqScore = Math.round(Math.min(faqN, 5) * 3)

  // 5) 태그 · 추천 대상 — max 10 (태그 6 + 추천대상 4)
  const tagN = (p.tags ?? []).filter((t) => t.trim()).length
  const recN = (p.recommendedFor ?? []).filter((t) => t.trim()).length
  const tagsScore = Math.round(Math.min(tagN, 5) * 1.2 + Math.min(recN, 4) * 1)

  // 6) 사진 — max 10 (8장 권장)
  const photoN = (p.images ?? []).length
  const photosScore = Math.round(Math.min(photoN, 8) * (10 / 8))

  // 7) 외부 포털 링크 — max 10 (6개 채널, 각 1.66점)
  const links = [p.naverPlaceUrl, p.kakaoMapUrl, p.googleBusinessUrl, p.homepageUrl, p.blogUrl, p.instagramUrl]
  const linkN = links.filter((v) => (v ?? '').trim().length > 0).length
  const linksScore = Math.round(linkN * (10 / 6))

  const items: CompletionItem[] = [
    {
      key: 'basic', label: '기본 정보', score: basic, max: 20,
      level: levelOf(basic, 20),
      href: `${baseHref}#sec-basic`,
      detail: descLen < 40 ? '소개 문구 40자 이상 권장' : undefined,
    },
    {
      key: 'contact', label: '연락 · 영업시간', score: contact, max: 15,
      level: levelOf(contact, 15),
      href: `${baseHref}#sec-contact`,
      detail: hoursN < 5 ? '영업시간 요일별로 입력' : undefined,
    },
    {
      key: 'services', label: '제공 서비스', score: servicesScore, max: 20,
      level: levelOf(servicesScore, 20),
      href: `${baseHref}#sec-services`,
      detail:
        services.length < 3 ? `서비스 ${Math.max(0, 3 - services.length)}개 더 추가 권장`
        : withPrice < services.length ? `가격 정보 ${services.length - withPrice}개 미등록`
        : undefined,
    },
    {
      key: 'faq', label: '자주 묻는 질문', score: faqScore, max: 15,
      level: levelOf(faqScore, 15),
      href: `${baseHref}#sec-faq`,
      detail: faqN < 3 ? `FAQ ${Math.max(0, 3 - faqN)}개 더 작성 권장` : undefined,
    },
    {
      key: 'tags', label: '태그 · 추천 대상', score: tagsScore, max: 10,
      level: levelOf(tagsScore, 10),
      href: `${baseHref}#sec-tags`,
      detail: tagN < 5 ? `태그 ${Math.max(0, 5 - tagN)}개 더 추가 권장` : undefined,
    },
    {
      key: 'photos', label: '사진', score: photosScore, max: 10,
      level: levelOf(photosScore, 10),
      href: `${baseHref}#sec-photos`,
      detail: photoN < 8 ? `권장 8장 · 현재 ${photoN}장` : undefined,
    },
    {
      key: 'links', label: '외부 포털 링크', score: linksScore, max: 10,
      level: levelOf(linksScore, 10),
      href: `${baseHref}#sec-links`,
      detail: linkN < 2 ? `외부 포털 ${Math.max(0, 2 - linkN)}개 이상 연결 권장` : undefined,
    },
  ]

  return items
}

export function sumCompletion(items: CompletionItem[]): { score: number; max: number; percent: number } {
  const score = items.reduce((s, i) => s + i.score, 0)
  const max = items.reduce((s, i) => s + i.max, 0)
  const percent = max === 0 ? 0 : Math.round((score / max) * 100)
  return { score, max, percent }
}
