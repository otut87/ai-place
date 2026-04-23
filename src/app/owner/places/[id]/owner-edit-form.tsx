'use client'

// T-141/T-216/T-217 — 사장님 단일 업체 편집 폼.
// place-edit.html 디자인 이식: .pe-sec 섹션 카드 + sticky save bar + chip 입력 + 섹션 네비.
// T-217: 영업시간 구조화 입력(요일별) + 전화 자동 하이픈 + 영문명 자동 로마자 변환 + slug 표시.

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { updateOwnerPlace } from '@/lib/actions/owner-places'
import { enrichFromGoogle } from '@/lib/actions/register-place'
import { ownerGenerateAiAction } from '@/lib/actions/owner-ai-generate'
import { getOwnerAiQuota } from '@/lib/actions/owner-ai-quota'
import type { RateLimitStatus } from '@/lib/ai/owner-generate'
import { SectionNav, type SectionNavItem } from './_components/section-nav'
import {
  parseHoursArray,
  serializeHoursMap,
  emptyHoursMap,
  DAY_ORDER,
  DAY_LABEL_KO,
  HOURS_PRESETS,
  timeOptions,
  type HoursMap,
  type DayCode,
} from '@/lib/format/hours-structured'
import { formatKoreanPhone } from '@/lib/format/phone'
import { suggestEnglishName } from '@/lib/format/hangul-romanize'

export interface PlaceImageItem {
  url: string
  alt: string
  type: string
}

export interface OwnerEditInitial {
  name: string
  nameEn: string
  address: string
  description: string
  phone: string
  openingHours: string[]
  tags: string[]
  images: PlaceImageItem[]
  services: Array<{ name: string; description?: string; priceRange?: string }>
  faqs: Array<{ question: string; answer: string }>
  recommendedFor: string[]
  strengths: string[]
  naverPlaceUrl: string
  kakaoMapUrl: string
  googleBusinessUrl: string
  homepageUrl: string
  blogUrl: string
  instagramUrl: string
  googlePlaceId: string
}

interface Props {
  placeId: string
  placeCity: string
  placeCategory: string
  placeSlug: string
  initial: OwnerEditInitial
  suggestedKeywords?: string[]
  publicHref?: string
  citationsHref?: string
}

// 소개 문구 스펙 — register-form / CONTENT_TOOL_SCHEMA / quality-score 와 통일.
// DESC_MIN ~ DESC_WARN 이 AI 품질 가산점 구간. DESC_MAX 는 서버 스키마(180) + 여유.
const DESC_MIN = 80
const DESC_WARN = 160
const DESC_MAX = 200
const MAX_TAGS = 10
const MAX_RECOMMENDED = 6

export function OwnerEditForm({
  placeId,
  placeCity,
  placeCategory,
  placeSlug,
  initial,
  suggestedKeywords = [],
  publicHref,
  citationsHref,
}: Props) {
  const [pending, startTransition] = useTransition()
  const [photoLoading, setPhotoLoading] = useState(false)
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── AI 자동 채우기 상태 (T-218) ──────────────────────
  const [aiLoading, setAiLoading] = useState(false)
  const [aiQuotaLeft, setAiQuotaLeft] = useState<number | null>(null)
  const [aiQuotaLimit, setAiQuotaLimit] = useState<number>(5)
  const [aiDisabledReason, setAiDisabledReason] = useState<string | undefined>(undefined)

  // ── 편집 필드 상태 ────────────────────────────────
  const [nameEn, setNameEn] = useState(initial.nameEn)
  const [description, setDescription] = useState(initial.description)
  const [phone, setPhone] = useState(formatKoreanPhone(initial.phone))
  const [hoursMap, setHoursMap] = useState<HoursMap>(() =>
    initial.openingHours.length > 0 ? parseHoursArray(initial.openingHours) : emptyHoursMap(),
  )
  const TIME_OPTS = useMemo(() => timeOptions(), [])

  // chip 기반 배열 필드들
  const [tags, setTags] = useState<string[]>(initial.tags)
  const [recommendedFor, setRecommendedFor] = useState<string[]>(initial.recommendedFor)
  const [strengths, setStrengths] = useState<string[]>(initial.strengths)

  const [services, setServices] = useState(
    initial.services.length > 0
      ? initial.services.map((s) => ({
          name: s.name,
          description: s.description ?? '',
          priceRange: s.priceRange ?? '',
        }))
      : [{ name: '', description: '', priceRange: '' }],
  )
  const [faqs, setFaqs] = useState(
    initial.faqs.length > 0
      ? initial.faqs
      : [{ question: '', answer: '' }],
  )

  const [naverPlaceUrl, setNaverPlaceUrl] = useState(initial.naverPlaceUrl)
  const [kakaoMapUrl, setKakaoMapUrl] = useState(initial.kakaoMapUrl)
  const [googleBusinessUrl, setGoogleBusinessUrl] = useState(initial.googleBusinessUrl)
  const [homepageUrl, setHomepageUrl] = useState(initial.homepageUrl)
  const [blogUrl, setBlogUrl] = useState(initial.blogUrl)
  const [instagramUrl, setInstagramUrl] = useState(initial.instagramUrl)

  // ── 사진 선택 상태 ────────────────────────────────
  // initial.images 의 proxy URL 에서 추출한 ref 배열 — 순서 보존.
  const initialRefs = useMemo(
    () => initial.images
      .map((i) => extractRefFromProxyUrl(i.url))
      .filter((r): r is string => !!r),
    [initial.images],
  )
  const [photoRefs, setPhotoRefs] = useState<string[]>(initialRefs)
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set(initialRefs))

  // ── dirty 추적 ────────────────────────────────────
  const initialSnapshot = useMemo(() => JSON.stringify(buildPatch({
    nameEn: initial.nameEn,
    description: initial.description,
    phone: formatKoreanPhone(initial.phone),
    openingHours: initial.openingHours,
    tags: initial.tags,
    recommendedFor: initial.recommendedFor,
    strengths: initial.strengths,
    services: initial.services.length > 0
      ? initial.services.map((s) => ({
          name: s.name,
          description: s.description ?? '',
          priceRange: s.priceRange ?? '',
        }))
      : [{ name: '', description: '', priceRange: '' }],
    faqs: initial.faqs.length > 0 ? initial.faqs : [{ question: '', answer: '' }],
    selectedImages: initial.images,
    naverPlaceUrl: initial.naverPlaceUrl,
    kakaoMapUrl: initial.kakaoMapUrl,
    googleBusinessUrl: initial.googleBusinessUrl,
    homepageUrl: initial.homepageUrl,
    blogUrl: initial.blogUrl,
    instagramUrl: initial.instagramUrl,
  })), [initial])

  // 선택된 ref 순서가 initial 과 동일하면 initial.images 를 그대로 사용 —
  // 관리자가 손본 alt/type/width 가 save 시 'exterior'+1200w 로 덮어쓰이지 않도록 보존.
  // ref 집합이 달라졌을 때만 새 shape 으로 재구성.
  const currentImages = useMemo<PlaceImageItem[]>(() => {
    const selectedOrdered = [...selectedPhotos].filter((ref) => photoRefs.includes(ref))
    const unchanged = selectedOrdered.length === initialRefs.length
      && selectedOrdered.every((ref, i) => ref === initialRefs[i])
    if (unchanged) return initial.images
    return selectedOrdered.map((ref) => ({
      url: `/api/places/photo?ref=${encodeURIComponent(ref)}&w=1200`,
      alt: initial.name,
      type: 'exterior',
    }))
  }, [selectedPhotos, photoRefs, initial.name, initial.images, initialRefs])

  const openingHoursSerialized = useMemo(() => serializeHoursMap(hoursMap), [hoursMap])

  const currentPatch = useMemo(() => buildPatch({
    nameEn, description, phone,
    openingHours: openingHoursSerialized,
    tags, recommendedFor, strengths,
    services, faqs,
    selectedImages: currentImages,
    naverPlaceUrl, kakaoMapUrl, googleBusinessUrl,
    homepageUrl, blogUrl, instagramUrl,
  }), [
    nameEn, description, phone, openingHoursSerialized,
    tags, recommendedFor, strengths,
    services, faqs, currentImages,
    naverPlaceUrl, kakaoMapUrl, googleBusinessUrl,
    homepageUrl, blogUrl, instagramUrl,
  ])

  const dirty = JSON.stringify(currentPatch) !== initialSnapshot
  const changedFieldCount = countChangedFields(currentPatch, JSON.parse(initialSnapshot))

  // ── 섹션 네비게이션 카운트 ─────────────────────────
  const navItems: SectionNavItem[] = [
    {
      id: 'sec-basic',
      label: '기본 정보',
      count: String(fieldFilled([initial.name, nameEn, initial.address, description])),
      done: Boolean(initial.name && description && initial.address),
    },
    {
      id: 'sec-contact',
      label: '연락처 · 영업시간',
      count: String((phone ? 1 : 0) + (openingHoursSerialized.length > 0 ? 1 : 0)),
      done: Boolean(phone) && openingHoursSerialized.length > 0,
    },
    {
      id: 'sec-services',
      label: '제공 서비스',
      count: String(services.filter((s) => s.name.trim()).length),
      done: services.filter((s) => s.name.trim()).length >= 2,
    },
    {
      id: 'sec-faq',
      label: '자주 묻는 질문',
      count: String(faqs.filter((f) => f.question.trim() && f.answer.trim()).length),
      done: faqs.filter((f) => f.question.trim() && f.answer.trim()).length >= 3,
    },
    {
      id: 'sec-tags',
      label: '태그 · 추천 대상',
      count: tags.length + recommendedFor.length > 0 ? `${tags.length + recommendedFor.length}` : '0',
      done: tags.length >= 3,
    },
    {
      id: 'sec-photos',
      label: '사진',
      count: String(selectedPhotos.size),
      done: selectedPhotos.size >= 1,
    },
    {
      id: 'sec-links',
      label: '외부 포털 링크',
      count: `${linksConnectedCount({ naverPlaceUrl, kakaoMapUrl, googleBusinessUrl, homepageUrl, blogUrl, instagramUrl })} / 6`,
      done: linksConnectedCount({ naverPlaceUrl, kakaoMapUrl, googleBusinessUrl, homepageUrl, blogUrl, instagramUrl }) >= 2,
    },
  ]

  // ── helpers ────────────────────────────────────────
  function showToast(msg: string, err = false) {
    setToast({ msg, err })
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2800)
  }

  function resetAll() {
    setNameEn(initial.nameEn)
    setDescription(initial.description)
    setPhone(formatKoreanPhone(initial.phone))
    setHoursMap(
      initial.openingHours.length > 0 ? parseHoursArray(initial.openingHours) : emptyHoursMap(),
    )
    setTags(initial.tags)
    setRecommendedFor(initial.recommendedFor)
    setStrengths(initial.strengths)
    setServices(
      initial.services.length > 0
        ? initial.services.map((s) => ({
            name: s.name,
            description: s.description ?? '',
            priceRange: s.priceRange ?? '',
          }))
        : [{ name: '', description: '', priceRange: '' }],
    )
    setFaqs(initial.faqs.length > 0 ? initial.faqs : [{ question: '', answer: '' }])
    setNaverPlaceUrl(initial.naverPlaceUrl)
    setKakaoMapUrl(initial.kakaoMapUrl)
    setGoogleBusinessUrl(initial.googleBusinessUrl)
    setHomepageUrl(initial.homepageUrl)
    setBlogUrl(initial.blogUrl)
    setInstagramUrl(initial.instagramUrl)
    setSelectedPhotos(
      new Set(initial.images.map((i) => extractRefFromProxyUrl(i.url)).filter((r): r is string => !!r)),
    )
    showToast('변경 사항을 되돌렸습니다')
  }

  async function handleRefreshPhotos() {
    setPhotoLoading(true)
    const r = await enrichFromGoogle({ name: initial.name, address: initial.address })
    setPhotoLoading(false)
    if (!r.success) {
      showToast(r.error || 'Google Places 불러오기 실패', true)
      return
    }
    if (!r.data.matched || !r.data.photoRefs || r.data.photoRefs.length === 0) {
      showToast('Google Places 에서 가져올 새 사진이 없습니다')
      return
    }
    const merged = Array.from(new Set([...photoRefs, ...r.data.photoRefs]))
    setPhotoRefs(merged)
    setSelectedPhotos((prev) => {
      const next = new Set(prev)
      for (const ref of r.data.photoRefs!) next.add(ref)
      return next
    })
    showToast(`Google 사진 ${r.data.photoRefs.length}장 불러왔습니다`)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const r = await updateOwnerPlace(placeId, currentPatch)
      if (r.success) {
        showToast(`${r.fieldsChanged ?? changedFieldCount}개 필드 저장됨 · AI 인덱스 업데이트 중`)
        // 페이지 refresh 없이 snapshot 을 현재 상태로 동기화. 단순하게 reload 로 서버 값 재조회.
        // SSR 헤더의 AEO score 와 updated_at 도 새로고침해야 해서 reload 가 정확.
        if (typeof window !== 'undefined') window.location.reload()
      } else {
        showToast(r.error ?? '업데이트 실패', true)
      }
    })
  }

  // ── AI 자동 채우기: quota 조회 + 실행 (T-218) ────────
  const applyRateLimit = useCallback((rl: RateLimitStatus | undefined) => {
    if (!rl) { setAiQuotaLeft(null); return }
    setAiQuotaLimit(rl.monthlyLimit)
    setAiQuotaLeft(Math.max(0, rl.monthlyLimit - rl.monthlyUsed))
    if (!rl.allowed && rl.reason === 'weekly' && rl.remainingHours > 0) {
      setAiDisabledReason(`주간 재시도 제한 — ${rl.remainingHours}시간 후 가능`)
    } else if (!rl.allowed && rl.reason === 'monthly') {
      setAiDisabledReason('30일 한도 소진 — 가장 오래된 사용 이력 만료 시 자동 복구')
    } else {
      setAiDisabledReason(undefined)
    }
  }, [])

  // mount 시 현재 quota 조회
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const rl = await getOwnerAiQuota(placeId)
      if (cancelled) return
      applyRateLimit(rl ?? undefined)
    })()
    return () => { cancelled = true }
  }, [placeId, applyRateLimit])

  async function handleAiFill() {
    if (aiLoading) return
    setAiLoading(true)
    try {
      const result = await ownerGenerateAiAction({
        placeId,
        name: initial.name,
        city: placeCity,
        category: placeCategory,
        existingFields: {
          description,
          tags,
          services: services.filter((s) => s.name.trim()).map((s) => ({
            name: s.name, description: s.description, priceRange: s.priceRange,
          })),
          recommendedFor,
          strengths,
        },
      })
      applyRateLimit(result.rateLimit)
      if (!result.success) {
        showToast(result.error || 'AI 생성 실패', true)
        return
      }
      // 빈 필드만 채움 (사용자 입력 덮어쓰기 금지)
      let filled = 0
      const o = result.output
      if (!description.trim() && o.description) { setDescription(o.description); filled += 1 }
      if (tags.length === 0 && o.tags?.length) { setTags(o.tags); filled += 1 }
      if (recommendedFor.length === 0 && o.recommendedFor?.length) { setRecommendedFor(o.recommendedFor); filled += 1 }
      if (strengths.length === 0 && o.strengths?.length) { setStrengths(o.strengths); filled += 1 }
      if (services.filter((s) => s.name.trim()).length === 0 && o.services?.length) {
        setServices(
          o.services.map((s) => ({
            name: s.name,
            description: s.description ?? '',
            priceRange: s.priceRange ?? '',
          })),
        )
        filled += 1
      }
      showToast(filled > 0 ? `AI 가 ${filled}개 섹션 초안을 채웠습니다. 검토 후 저장하세요.` : '이미 모든 섹션이 채워져 있어 AI 초안은 반영되지 않았습니다')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'AI 생성 중 오류', true)
    } finally {
      setAiLoading(false)
    }
  }

  // ── chip add/remove helpers ────────────────────────
  function addChip(list: string[], setList: (v: string[]) => void, value: string, max: number) {
    const v = value.trim()
    if (!v) return
    if (list.includes(v)) return
    if (list.length >= max) return
    setList([...list, v])
  }

  const descLen = description.length
  const descCountClass = descLen > DESC_WARN ? 'warn' : descLen >= DESC_MIN ? 'ok' : ''

  // ── 서비스 · FAQ 완료 개수 표시 헬퍼 ───────────────
  const servicesDone = services.filter((s) => s.name.trim()).length
  const faqsDone = faqs.filter((f) => f.question.trim() && f.answer.trim()).length
  const tagsOnlyCount = tags.length
  const recommendedCount = recommendedFor.length
  const tagsProgDone = tagsOnlyCount >= 3

  return (
    <>
      <SectionNav
        items={navItems}
        publicHref={publicHref}
        citationsHref={citationsHref}
        ai={{
          onFill: handleAiFill,
          loading: aiLoading,
          quotaLeft: aiQuotaLeft,
          quotaLimit: aiQuotaLimit,
          disabledReason: aiDisabledReason,
        }}
      />

      <form onSubmit={handleSubmit} className="pe-form">

        {/* ========== 기본 정보 ========== */}
        <section className="pe-sec" id="sec-basic">
          <div className="pe-sec-head">
            <div className="lead">
              <div className="eyebrow">Section 01</div>
              <h2>기본 정보</h2>
              <p className="desc">AI 가 사용자에게 업체를 소개할 때 가장 먼저 읽는 정보입니다. 소개 문구는 <b>가장 중요한 포인트를 앞쪽</b> 에 배치하세요.</p>
            </div>
          </div>

          <div className="pe-field">
            <label>업체명 <span className="opt">관리자 문의 필요</span></label>
            <p className="hint">변경하면 공개 페이지의 타이틀이 함께 갱신됩니다. 업체명 변경은 담당자에게 문의해주세요.</p>
            <input className="pe-inp" value={initial.name} disabled />
          </div>

          <div className="pe-field">
            <label>공개 페이지 URL <span className="opt">자동 생성</span></label>
            <p className="hint">업체가 공개되는 고유 주소입니다. SEO·외부 링크 안정성을 위해 변경되지 않습니다.</p>
            <div className="slug-display">
              <span className="prefix">aiplace.kr/{placeCity}/{placeCategory}/</span>
              <span className="slug-value">{placeSlug}</span>
            </div>
          </div>

          <div className="pe-field">
            <div className="field-inline-action">
              <label>영문 / 대체 이름 <span className="opt">선택</span></label>
              <button
                type="button"
                className="auto-fill-btn"
                onClick={() => setNameEn(suggestEnglishName(initial.name))}
                title="업체명(한글)에서 로마자 자동 변환"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                  <path d="M12 2l2.4 5.6L20 10l-5.6 2.4L12 18l-2.4-5.6L4 10l5.6-2.4z" />
                </svg>
                한글 → 영문 자동 변환
              </button>
            </div>
            <p className="hint">영어로 질문하는 사용자에게 보여지는 이름입니다. 빈 값이면 자동 생성된 로마자가 사용됩니다.</p>
            <input
              className="pe-inp"
              value={nameEn}
              onChange={(e) => setNameEn(e.target.value)}
              placeholder={suggestEnglishName(initial.name) || '예: Cleanhue Clinic'}
            />
          </div>

          <div className="pe-field">
            <label>주소 <span className="opt">관리자 문의 필요</span></label>
            <p className="hint">지번·도로명 중 하나로 충분합니다. AI 는 둘 다 인식합니다.</p>
            <input className="pe-inp" value={initial.address} disabled />
          </div>

          <div className="pe-field">
            <label>소개 문구 <span className="req">*</span> <span className="opt">권장 {DESC_MIN}–{DESC_WARN}자</span></label>
            <p className="hint"><b>누가, 어디서, 무엇을 잘하는지</b> 가 첫 문장에 들어가면 AI 인용률이 평균 2.8배 올라갑니다.</p>
            <textarea
              className="pe-ta"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={DESC_MAX}
              rows={3}
            />
            <div className={`count ${descCountClass}`}>
              <span>{descLen}</span> / {DESC_MAX}자
            </div>
          </div>
        </section>

        {/* ========== 연락처 · 영업시간 ========== */}
        <section className="pe-sec" id="sec-contact">
          <div className="pe-sec-head">
            <div className="lead">
              <div className="eyebrow">Section 02</div>
              <h2>연락처 · 영업시간</h2>
              <p className="desc">AI 가 &ldquo;지금 전화할 수 있나요?&rdquo; 같은 질문에 답할 때 직접 참조합니다.</p>
            </div>
          </div>

          <div className="pe-field">
            <label htmlFor="phone-input">대표 전화 <span className="req">*</span></label>
            <p className="hint">숫자만 입력하면 자동으로 하이픈이 붙습니다. AI 답변에 클릭 가능한 번호로 노출됩니다.</p>
            <input
              id="phone-input"
              className="pe-inp mono"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(formatKoreanPhone(e.target.value))}
              placeholder="041-123-4567"
              maxLength={14}
            />
          </div>

          <div className="pe-field">
            <label>영업시간 <span className="req">*</span></label>
            <p className="hint">요일별로 여는 시간을 선택하세요. 쉬는 요일은 <b>휴무</b> 체크. Schema.org 포맷으로 저장되어 AI 가 정확히 인식합니다.</p>

            <div className="hours-presets">
              <span className="hp-lbl">빠른 설정</span>
              {HOURS_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className="hp"
                  onClick={() => setHoursMap(preset.apply(hoursMap))}
                >
                  <b>{preset.label}</b>
                  <span>{preset.description}</span>
                </button>
              ))}
            </div>

            <div className="hours-grid">
              {DAY_ORDER.map((d) => {
                const row = hoursMap[d]
                const dayCls = d === 'Su' ? 'day sun' : d === 'Sa' ? 'day sat' : 'day'
                return (
                  <div key={d} className={`hrow${row.closed ? ' closed' : ''}`}>
                    <span className={dayCls}>{DAY_LABEL_KO[d]}</span>
                    {row.closed ? (
                      <span className="closed-chip">휴무</span>
                    ) : (
                      <div className="times">
                        <select
                          value={row.open}
                          onChange={(e) => updateHoursDay(setHoursMap, d, { open: e.target.value })}
                          aria-label={`${DAY_LABEL_KO[d]}요일 여는 시간`}
                        >
                          {TIME_OPTS.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <span className="sep-d">–</span>
                        <select
                          value={row.close}
                          onChange={(e) => updateHoursDay(setHoursMap, d, { close: e.target.value })}
                          aria-label={`${DAY_LABEL_KO[d]}요일 닫는 시간`}
                        >
                          {TIME_OPTS.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                    )}
                    <label className="tg">
                      <input
                        type="checkbox"
                        checked={row.closed}
                        onChange={(e) => updateHoursDay(setHoursMap, d, { closed: e.target.checked })}
                      />
                      휴무
                    </label>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* ========== 제공 서비스 ========== */}
        <section className="pe-sec" id="sec-services">
          <div className="pe-sec-head">
            <div className="lead">
              <div className="eyebrow">Section 03</div>
              <h2>제공 서비스</h2>
              <p className="desc">각 서비스는 한 줄 설명과 가격대를 적어주세요. <b>가격은 범위로</b> 적는 편이 AI 추천에 더 유리합니다.</p>
            </div>
            <div className="meta-col">
              <div className={`prog${servicesDone >= 2 ? ' full' : ''}`}>
                등록 · <b>{servicesDone}개</b>
              </div>
            </div>
          </div>

          <div className="svc-list">
            {services.map((s, i) => (
              <div className="svc" key={i}>
                <span className="drag" aria-hidden="true" title="드래그하여 순서 변경 (준비 중)">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <circle cx="9" cy="6" r="1.2" />
                    <circle cx="15" cy="6" r="1.2" />
                    <circle cx="9" cy="12" r="1.2" />
                    <circle cx="15" cy="12" r="1.2" />
                    <circle cx="9" cy="18" r="1.2" />
                    <circle cx="15" cy="18" r="1.2" />
                  </svg>
                </span>
                <div className="sv-main">
                  <input
                    className="name"
                    aria-label="서비스명"
                    placeholder="서비스명 (예: 주택 인테리어)"
                    value={s.name}
                    onChange={(e) => {
                      const next = [...services]
                      next[i] = { ...next[i], name: e.target.value }
                      setServices(next)
                    }}
                  />
                  <input
                    className="desc"
                    aria-label="한 줄 설명"
                    placeholder="한 줄 설명 (예: 아파트·주택 주거공간 내부 설계 및 시공)"
                    value={s.description}
                    onChange={(e) => {
                      const next = [...services]
                      next[i] = { ...next[i], description: e.target.value }
                      setServices(next)
                    }}
                  />
                </div>
                <input
                  className="price"
                  aria-label="가격대"
                  placeholder="50–300만원"
                  value={s.priceRange}
                  onChange={(e) => {
                    const next = [...services]
                    next[i] = { ...next[i], priceRange: e.target.value }
                    setServices(next)
                  }}
                />
                <button
                  type="button"
                  className="x"
                  onClick={() => setServices(services.filter((_, j) => j !== i))}
                  title="서비스 삭제"
                  aria-label="서비스 삭제"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                    <path d="M6 6l12 12M6 18L18 6" />
                  </svg>
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            className="add-btn"
            onClick={() => setServices([...services, { name: '', description: '', priceRange: '' }])}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
            서비스 추가
          </button>
        </section>

        {/* ========== 자주 묻는 질문 ========== */}
        <section className="pe-sec" id="sec-faq">
          <div className="pe-sec-head">
            <div className="lead">
              <div className="eyebrow">Section 04</div>
              <h2>자주 묻는 질문</h2>
              <p className="desc">실제 고객이 자주 묻는 질문을 구어체로 적어주세요. AI 가 그대로 인용할 가능성이 높아집니다.</p>
            </div>
            <div className="meta-col">
              <div className={`prog${faqsDone >= 3 ? ' full' : ''}`}>
                작성 · <b>{faqsDone}개</b>
              </div>
            </div>
          </div>

          <div className="faq-list">
            {faqs.map((f, i) => (
              <div className="faq" key={i}>
                <button
                  type="button"
                  className="f-x"
                  onClick={() => setFaqs(faqs.filter((_, j) => j !== i))}
                  title="FAQ 삭제"
                  aria-label="FAQ 삭제"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                    <path d="M6 6l12 12M6 18L18 6" />
                  </svg>
                </button>
                <input
                  className="f-q"
                  aria-label="질문"
                  placeholder="Q. 고객이 자주 묻는 질문 (예: 영업시간은 어떻게 되나요?)"
                  value={f.question}
                  onChange={(e) => {
                    const next = [...faqs]
                    next[i] = { ...next[i], question: e.target.value }
                    setFaqs(next)
                  }}
                />
                <textarea
                  className="f-a"
                  aria-label="답변"
                  placeholder="A. 구어체로 답변해주세요 (예: 평일은 오전 9시부터 저녁 7시까지 운영하고 있어요)"
                  value={f.answer}
                  onChange={(e) => {
                    const next = [...faqs]
                    next[i] = { ...next[i], answer: e.target.value }
                    setFaqs(next)
                  }}
                />
              </div>
            ))}
          </div>

          <button
            type="button"
            className="add-btn"
            onClick={() => setFaqs([...faqs, { question: '', answer: '' }])}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
            FAQ 추가
          </button>
        </section>

        {/* ========== 태그 · 추천 대상 ========== */}
        <section className="pe-sec" id="sec-tags">
          <div className="pe-sec-head">
            <div className="lead">
              <div className="eyebrow">Section 05</div>
              <h2>태그 · 추천 대상 · 강점</h2>
              <p className="desc">AI 가 &ldquo;어떤 사람에게 이 업체를 추천할까?&rdquo; 를 결정할 때 참고합니다. <b>구체적일수록 좋습니다.</b></p>
            </div>
            <div className="meta-col">
              <div className={`prog${tagsProgDone ? ' full' : ''}`}>
                태그 · <b>{tagsOnlyCount} / 최대 {MAX_TAGS}</b>
              </div>
            </div>
          </div>

          <ChipGroup
            label="태그"
            hint={`${tagsOnlyCount} / 최대 ${MAX_TAGS}개`}
            chips={tags}
            placeholder="태그 입력 후 Enter, 또는 쉼표"
            onAdd={(v) => addChip(tags, setTags, v, MAX_TAGS)}
            onRemove={(v) => setTags(tags.filter((t) => t !== v))}
            suggestions={suggestedKeywords.filter((k) => !tags.includes(k)).slice(0, 8)}
          />

          {suggestedKeywords.length > 0 && (
            <p className="hint" style={{ marginTop: -10, marginBottom: 12, fontSize: 11.5 }}>
              추천 키워드 — 내 업종에서 AI 검색이 자주 묻는 단어입니다. 클릭하면 태그에 추가됩니다.
            </p>
          )}

          <ChipGroup
            label="추천 대상"
            hint={`${recommendedCount} / 최대 ${MAX_RECOMMENDED}개`}
            chips={recommendedFor}
            placeholder="예: 신혼부부, 카페 오픈 예정"
            onAdd={(v) => addChip(recommendedFor, setRecommendedFor, v, MAX_RECOMMENDED)}
            onRemove={(v) => setRecommendedFor(recommendedFor.filter((t) => t !== v))}
          />

          <ChipGroup
            label="강점"
            hint={strengths.length > 0 ? `${strengths.length}개` : '아직 없음'}
            chips={strengths}
            placeholder="예: 20년 경력, 야간 진료, 한국어·영어 모두"
            onAdd={(v) => addChip(strengths, setStrengths, v, 8)}
            onRemove={(v) => setStrengths(strengths.filter((t) => t !== v))}
          />
        </section>

        {/* ========== 사진 ========== */}
        <section className="pe-sec" id="sec-photos">
          <div className="pe-sec-head">
            <div className="lead">
              <div className="eyebrow">Section 06</div>
              <h2>사진</h2>
              <p className="desc">Google Places 에 등록된 사진이 자동으로 표시됩니다. <b>대표 사진 1장과 내부 사진 3–6장</b> 을 권장합니다.</p>
            </div>
            <div className="meta-col">
              <div className={`prog${selectedPhotos.size >= 1 ? ' full' : ''}`}>
                선택 · <b>{selectedPhotos.size}개</b>
              </div>
            </div>
          </div>

          <div className="ph-intro">
            <div className="g-ic">G</div>
            <div className="tx">
              Google Places 에 연결된 사진이 자동으로 보여집니다. Google Business Profile 쪽에서 <b>사진을 등록</b> 하면 여기에서 다시 불러올 수 있어요.
            </div>
            <button
              type="button"
              className="btn-sm"
              onClick={handleRefreshPhotos}
              disabled={photoLoading}
            >
              {photoLoading ? '불러오는 중…' : '다시 불러오기 ↻'}
            </button>
          </div>

          {photoRefs.length === 0 ? (
            <div className="ph-grid">
              <button
                type="button"
                className="ph add"
                onClick={handleRefreshPhotos}
                disabled={photoLoading}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                <span className="lab">Google 에서 불러오기</span>
              </button>
            </div>
          ) : (
            <div className="ph-grid">
              {photoRefs.map((ref, idx) => {
                const checked = selectedPhotos.has(ref)
                return (
                  <button
                    key={ref}
                    type="button"
                    className={`ph${checked ? ' selected' : ''}${checked && idx === 0 ? ' cover' : ''}`}
                    onClick={() => {
                      setSelectedPhotos((prev) => {
                        const next = new Set(prev)
                        if (next.has(ref)) next.delete(ref)
                        else next.add(ref)
                        return next
                      })
                    }}
                    title={checked ? '클릭하여 선택 해제' : '클릭하여 선택'}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/places/photo?ref=${encodeURIComponent(ref)}&w=400`} alt="" loading="lazy" />
                  </button>
                )
              })}
            </div>
          )}
        </section>

        {/* ========== 외부 포털 링크 ========== */}
        <section className="pe-sec" id="sec-links">
          <div className="pe-sec-head">
            <div className="lead">
              <div className="eyebrow">Section 07</div>
              <h2>외부 포털 링크</h2>
              <p className="desc">Google, 네이버, 카카오 등 외부 포털에 이미 업체가 있다면 링크를 걸어주세요. AI 는 여러 출처를 함께 읽을 때 신뢰도를 올립니다.</p>
            </div>
            <div className="meta-col">
              <div className={`prog${linksConnectedCount({ naverPlaceUrl, kakaoMapUrl, googleBusinessUrl, homepageUrl, blogUrl, instagramUrl }) >= 2 ? ' full' : ''}`}>
                연결 · <b>{linksConnectedCount({ naverPlaceUrl, kakaoMapUrl, googleBusinessUrl, homepageUrl, blogUrl, instagramUrl })} / 6</b>
              </div>
            </div>
          </div>

          <div className="row-2">
            <LinkField
              label="네이버 플레이스"
              hint="플레이스 공유 URL 또는 naver.me 단축 링크"
              value={naverPlaceUrl}
              onChange={setNaverPlaceUrl}
              placeholder="https://naver.me/..."
              icon={
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M16.273 12.845L7.376 0H0v24h7.727V11.155L16.624 24H24V0h-7.727z" />
                </svg>
              }
            />
            <LinkField
              label="카카오맵"
              hint="카카오맵 공유 링크"
              value={kakaoMapUrl}
              onChange={setKakaoMapUrl}
              placeholder="https://place.map.kakao.com/..."
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              }
            />
            <LinkField
              label="Google Business Profile"
              hint="위의 Google 사진 동기화에 사용됩니다"
              value={googleBusinessUrl}
              onChange={setGoogleBusinessUrl}
              placeholder="https://maps.google.com/..."
              icon={
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                </svg>
              }
            />
            <LinkField
              label="홈페이지"
              hint="업체 공식 웹사이트"
              value={homepageUrl}
              onChange={setHomepageUrl}
              placeholder="https://..."
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M2 12h20M12 2a15 15 0 010 20M12 2a15 15 0 000 20" />
                </svg>
              }
            />
            <LinkField
              label="블로그"
              hint="업체 공식 블로그 혹은 대표 블로그"
              value={blogUrl}
              onChange={setBlogUrl}
              placeholder="https://blog.naver.com/..."
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              }
            />
            <LinkField
              label="인스타그램"
              hint="전체 URL 또는 @아이디"
              value={instagramUrl}
              onChange={setInstagramUrl}
              placeholder="@business_account"
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
                  <rect x="2" y="2" width="20" height="20" rx="5" />
                  <circle cx="12" cy="12" r="4" />
                  <circle cx="18" cy="6" r="1" fill="currentColor" />
                </svg>
              }
            />
          </div>
        </section>

      </form>

      {/* ========== STICKY SAVE BAR ========== */}
      <div className={`pe-save-bar${dirty ? ' dirty' : ''}`}>
        <div className="wrap-in">
          <div className="msg">
            <span className="dot"></span>
            <span className="t">
              {pending ? '저장 중…' : dirty ? '변경사항이 있습니다' : '변경 사항이 없습니다'}
            </span>
            {dirty && !pending && <span className="n">{changedFieldCount}개 필드 수정됨</span>}
          </div>
          <div className="actions">
            <button
              type="button"
              className="btn ghost"
              onClick={resetAll}
              disabled={!dirty || pending}
            >
              취소
            </button>
            <button
              type="button"
              className="btn primary"
              onClick={handleSubmit}
              disabled={!dirty || pending}
            >
              {pending ? '저장 중…' : '변경사항 저장'}
            </button>
          </div>
        </div>
      </div>

      {toast && (
        <div className={`pe-toast on${toast.err ? ' err' : ''}`} role={toast.err ? 'alert' : 'status'}>
          {toast.msg}
        </div>
      )}
    </>
  )
}

// ─────────────────────────────────────────────────────────────
// 보조 컴포넌트
// ─────────────────────────────────────────────────────────────

interface ChipGroupProps {
  label: string
  hint: string
  chips: string[]
  placeholder: string
  onAdd: (value: string) => void
  onRemove: (value: string) => void
  suggestions?: string[]
}

function ChipGroup({ label, hint, chips, placeholder, onAdd, onRemove, suggestions }: ChipGroupProps) {
  const [input, setInput] = useState('')

  function commit(value: string) {
    const v = value.trim().replace(/,$/, '')
    if (!v) return
    onAdd(v)
    setInput('')
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      commit(input)
    } else if (e.key === 'Backspace' && !input && chips.length > 0) {
      onRemove(chips[chips.length - 1])
    }
  }

  return (
    <div className="chip-group">
      <div className="lbl">
        {label}
        <span className="cnt-sm">{hint}</span>
      </div>
      <div className="chip-box">
        {chips.map((c) => (
          <span key={c} className="pe-chip">
            {c}
            <button type="button" onClick={() => onRemove(c)} aria-label={`${c} 삭제`}>×</button>
          </span>
        ))}
        <input
          className="chip-add-inp"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => { if (input) commit(input) }}
          placeholder={placeholder}
        />
      </div>
      {suggestions && suggestions.length > 0 && (
        <div className="chip-sug">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              className="sg"
              onClick={() => onAdd(s)}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

interface LinkFieldProps {
  label: string
  hint: string
  value: string
  onChange: (v: string) => void
  placeholder: string
  icon: React.ReactNode
}

function LinkField({ label, hint, value, onChange, placeholder, icon }: LinkFieldProps) {
  const connected = value.trim().length > 0
  return (
    <div className="pe-field">
      <label>{label}</label>
      <p className="hint">{hint}</p>
      <div className="link-field">
        <span className="pfx">{icon}</span>
        <input
          type="url"
          className="pe-inp mono"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
        <span className={`stat ${connected ? 'ok' : 'empty'}`}>
          {connected ? '연결됨' : '미연결'}
        </span>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// 유틸 함수
// ─────────────────────────────────────────────────────────────

function extractRefFromProxyUrl(url: string): string | null {
  const m = url.match(/[?&]ref=([^&]+)/)
  if (!m) return null
  try { return decodeURIComponent(m[1]) } catch { return null }
}

function fieldFilled(values: Array<string | null | undefined>): number {
  return values.filter((v) => typeof v === 'string' && v.trim().length > 0).length
}

function updateHoursDay(
  setter: React.Dispatch<React.SetStateAction<HoursMap>>,
  day: DayCode,
  patch: Partial<HoursMap[DayCode]>,
) {
  setter((prev) => ({ ...prev, [day]: { ...prev[day], ...patch } }))
}

function linksConnectedCount(links: {
  naverPlaceUrl: string
  kakaoMapUrl: string
  googleBusinessUrl: string
  homepageUrl: string
  blogUrl: string
  instagramUrl: string
}): number {
  return [
    links.naverPlaceUrl,
    links.kakaoMapUrl,
    links.googleBusinessUrl,
    links.homepageUrl,
    links.blogUrl,
    links.instagramUrl,
  ].filter((v) => v.trim().length > 0).length
}

interface PatchInput {
  nameEn: string
  description: string
  phone: string
  openingHours: string[]
  tags: string[]
  recommendedFor: string[]
  strengths: string[]
  services: Array<{ name: string; description: string; priceRange: string }>
  faqs: Array<{ question: string; answer: string }>
  selectedImages: PlaceImageItem[]
  naverPlaceUrl: string
  kakaoMapUrl: string
  googleBusinessUrl: string
  homepageUrl: string
  blogUrl: string
  instagramUrl: string
}

function buildPatch(input: PatchInput): Record<string, unknown> {
  return {
    name_en: input.nameEn.trim(),
    description: input.description,
    phone: input.phone.trim(),
    opening_hours: input.openingHours,
    tags: input.tags,
    services: input.services.filter((s) => s.name.trim()).map((s) => ({
      name: s.name.trim(),
      description: s.description.trim(),
      priceRange: s.priceRange.trim(),
    })),
    faqs: input.faqs.filter((f) => f.question.trim() && f.answer.trim()),
    recommended_for: input.recommendedFor,
    strengths: input.strengths,
    images: input.selectedImages,
    naver_place_url: input.naverPlaceUrl,
    kakao_map_url: input.kakaoMapUrl,
    google_business_url: input.googleBusinessUrl,
    homepage_url: input.homepageUrl,
    blog_url: input.blogUrl,
    instagram_url: input.instagramUrl,
  }
}

function countChangedFields(a: Record<string, unknown>, b: Record<string, unknown>): number {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  let n = 0
  for (const k of keys) {
    if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) n += 1
  }
  return n
}
