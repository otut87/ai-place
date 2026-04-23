'use client'

// T-201/T-220 — Owner 업체 등록 폼.
// 플로우: (1) 네이버 검색 → (2) 후보 선택 → (3) 정보 편집 + AI 자동 생성 → (4) 등록.
// T-220: 실제 schema(places 테이블) 필드 전부 입력 가능하게 확장. 편집 페이지(pe-*) 와 동일한 유틸(
//   hours-structured, phone, hangul-romanize) 공유. 누락 필드(recommended_for, strengths, blog_url,
//   instagram_url, google_business_url)를 chip/link 입력으로 노출.

import { useMemo, useState, type ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  searchPlaceByNaver,
  enrichFromGoogle,
  generatePlaceContent,
  generateRecommendation,
  type NaverCandidate,
} from '@/lib/actions/register-place'
import { registerOwnerPlaceAction } from '@/lib/actions/owner-register-place'
import type { PlaceSearchResult } from '@/lib/google-places'
import { ClaimPlaceButton } from '@/components/business/claim-place-button'
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
import { suggestEnglishName, romanizeKorean } from '@/lib/format/hangul-romanize'

interface Props {
  cities: Array<{ slug: string; name: string }>
  categories: Array<{ slug: string; name: string; sector: string }>
}

type Step = 1 | 2 | 3 | 4

export function OwnerRegisterForm({ cities, categories }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [selectedSector, setSelectedSector] = useState('')
  const [catSearch, setCatSearch] = useState('')
  const filteredCategories = categories.filter((c) => {
    const matchesSector = selectedSector ? c.sector === selectedSector : true
    const matchesSearch = catSearch
      ? c.name.includes(catSearch) || c.slug.includes(catSearch.toLowerCase())
      : true
    return matchesSector && matchesSearch
  })

  const [city, setCity] = useState(cities[0]?.slug ?? 'cheonan')
  const [category, setCategory] = useState('')
  const [query, setQuery] = useState('')
  const [naverResults, setNaverResults] = useState<NaverCandidate[]>([])

  const [selectedPlace, setSelectedPlace] = useState<PlaceSearchResult | null>(null)
  const [nameEn, setNameEn] = useState('')
  const [slug, setSlug] = useState('')
  const [description, setDescription] = useState('')
  const [phone, setPhone] = useState('')
  const [hoursMap, setHoursMap] = useState<HoursMap>(emptyHoursMap())
  const TIME_OPTS = useMemo(() => timeOptions(), [])

  // 외부 링크 (places schema 의 6개 채널 모두)
  const [naverPlaceUrl, setNaverPlaceUrl] = useState('')
  const [kakaoMapUrl, setKakaoMapUrl] = useState('')
  const [googleBusinessUrl, setGoogleBusinessUrl] = useState('')
  const [homepageUrl, setHomepageUrl] = useState('')
  const [blogUrl, setBlogUrl] = useState('')
  const [instagramUrl, setInstagramUrl] = useState('')

  const [enrichedReviews, setEnrichedReviews] = useState<Array<{ text: string; rating: number }>>([])
  const [enrichedData, setEnrichedData] = useState<{ openingHours?: string[]; editorialSummary?: string; websiteUri?: string; googleMapsUri?: string } | null>(null)

  const [services, setServices] = useState([{ name: '', description: '', priceRange: '' }])
  const [faqs, setFaqs] = useState([
    { question: '', answer: '' },
    { question: '', answer: '' },
    { question: '', answer: '' },
  ])
  const [tags, setTags] = useState<string[]>([])
  const [recommendedFor, setRecommendedFor] = useState<string[]>([])
  const [strengths, setStrengths] = useState<string[]>([])
  const [photoRefs, setPhotoRefs] = useState<string[]>([])
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set())

  const currentStep: Step =
    !selectedPlace && naverResults.length === 0 && !loading ? 1 :
    !selectedPlace && (naverResults.length > 0 || loading) ? 2 :
    selectedPlace ? 3 : 1

  // ── 액션 ────────────────────────────────────────────────────────────

  async function handleSearch() {
    if (!query.trim()) return
    setLoading(true)
    setError(null)
    setNaverResults([])
    const result = await searchPlaceByNaver(query)
    setLoading(false)
    if (result.success) setNaverResults(result.data)
    else setError(result.error)
  }

  async function handleSelectNaver(c: NaverCandidate) {
    if (c.detectedCitySlug && cities.some((x) => x.slug === c.detectedCitySlug)) {
      setCity(c.detectedCitySlug)
    }
    if (c.detectedCategorySlug && categories.some((x) => x.slug === c.detectedCategorySlug)) {
      setCategory(c.detectedCategorySlug)
      const cat = categories.find((x) => x.slug === c.detectedCategorySlug)
      if (cat) {
        setSelectedSector(cat.sector)
        setCatSearch(cat.name)
      }
    }

    const naverBased: PlaceSearchResult = {
      placeId: 'naver',
      name: c.displayName,
      address: c.roadAddress ?? c.jibunAddress ?? '',
      latitude: c.latitude,
      longitude: c.longitude,
    }
    setSelectedPlace(naverBased)
    setNaverResults([])
    if (c.phone) setPhone(formatKoreanPhone(c.phone))
    // Naver/Kakao 는 공식 비즈니스 URL 이 없으면 검색 링크로 치환해도 빈 페이지/지도 핀만 나옴.
    // 사장님이 직접 본인 업체 페이지 URL 을 붙여넣도록 빈 값 유지 — 옆 "새창에서 찾기" 버튼으로 보조.
    setNaverPlaceUrl('')
    setKakaoMapUrl('')

    // 한글명 → Revised Romanization → slug. 40자 cap (Naver 이름은 지점·상호·분야 다 붙여서 매우 김).
    // 바로 뒤에 Google enrichment 가 nameEn 을 주면 재생성함.
    const naverSlug = buildSlug(romanizeKorean(c.displayName))
    const fallbackStamp = new Date().getTime().toString(36).slice(-4)
    setSlug(naverSlug || `${c.detectedCategorySlug ?? 'place'}-${fallbackStamp}`)

    // 한글명 → 영문명 초안 자동 생성
    setNameEn(suggestEnglishName(c.displayName))

    setLoading(true)
    const enriched = await enrichFromGoogle({
      name: c.displayName,
      address: c.roadAddress ?? c.jibunAddress ?? '',
    })
    setLoading(false)
    if (!enriched.success || !enriched.data.matched) return

    const d = enriched.data
    setSelectedPlace((prev) => prev ? {
      ...prev,
      placeId: d.googlePlaceId ?? 'naver',
      rating: d.rating,
      reviewCount: d.reviewCount,
    } : prev)
    if (d.nameEn) {
      setNameEn(d.nameEn)
      // Google 영문명 기준 slug 재생성 — 한글 음절 나열보다 훨씬 깔끔·짧음.
      const enSlug = buildSlug(d.nameEn)
      if (enSlug) setSlug(enSlug)
    }
    if (d.phone && !c.phone) setPhone(formatKoreanPhone(d.phone))
    // Google 영업시간 → Schema.org 약어 배열로 변환 후 hoursMap 에 병합
    if (d.openingHours) {
      const schemaArr = convertGoogleHoursToSchemaOrg(d.openingHours)
      if (schemaArr.length > 0) {
        setHoursMap(parseHoursArray(schemaArr))
      }
    }
    if (d.reviews) setEnrichedReviews(d.reviews)
    setEnrichedData({
      openingHours: d.openingHours,
      editorialSummary: d.editorialSummary,
      websiteUri: d.websiteUri,
      googleMapsUri: d.googleMapsUri,
    })
    // 외부 링크 자동 채움 — Google 에서 받아온 URL 이 있으면 빈 필드에 주입
    if (d.googleMapsUri) setGoogleBusinessUrl(d.googleMapsUri)
    if (d.websiteUri) setHomepageUrl(d.websiteUri)
    if (d.photoRefs && d.photoRefs.length > 0) {
      setPhotoRefs(d.photoRefs)
      setSelectedPhotos(new Set(d.photoRefs))
    }
  }

  async function handleAiGenerate() {
    if (!selectedPlace || !category) {
      setError('업종을 먼저 선택해 주세요.')
      return
    }
    setAiLoading(true)
    setError(null)

    // Content(소개/서비스/FAQ/태그) + Recommendation(추천대상/강점) 병렬 호출.
    // 서비스 초안이 먼저 필요한 recommendation 은 content 완료 후 실행.
    const contentResult = await generatePlaceContent({
      name: selectedPlace.name,
      category,
      address: selectedPlace.address,
      rating: selectedPlace.rating,
      reviewCount: selectedPlace.reviewCount,
      reviews: enrichedReviews,
      openingHours: enrichedData?.openingHours,
      editorialSummary: enrichedData?.editorialSummary,
    })

    if (!contentResult.success) {
      setAiLoading(false)
      setError(contentResult.error)
      return
    }

    if (contentResult.data.description) setDescription(contentResult.data.description)
    const generatedServices = contentResult.data.services.map((s) => ({
      name: s.name,
      description: s.description ?? '',
      priceRange: s.priceRange ?? '',
    }))
    setServices(generatedServices)
    setFaqs(contentResult.data.faqs)
    setTags(contentResult.data.tags)

    // 추천 대상·강점 — 서비스 초안을 컨텍스트로 넣어 품질↑.
    const recoResult = await generateRecommendation({
      name: selectedPlace.name,
      category,
      address: selectedPlace.address,
      services: generatedServices,
      rating: selectedPlace.rating,
      reviewCount: selectedPlace.reviewCount,
      reviews: enrichedReviews,
    })
    setAiLoading(false)
    if (recoResult.success) {
      if (recoResult.data.recommendedFor.length > 0) setRecommendedFor(recoResult.data.recommendedFor)
      if (recoResult.data.strengths.length > 0) setStrengths(recoResult.data.strengths)
    }
    // recoResult 실패해도 content 는 성공했으므로 에러 표시 안 함.
  }

  async function handleSubmit() {
    if (!selectedPlace) return
    if (!city || !category) {
      setError('도시와 업종을 선택해 주세요.')
      return
    }
    setLoading(true)
    setError(null)
    const isNaverOnly = selectedPlace.placeId === 'naver'
    const hoursArray = serializeHoursMap(hoursMap)
    const images = [...selectedPhotos]
      .filter((ref) => photoRefs.includes(ref))
      .map((ref) => ({
        url: `/api/places/photo?ref=${encodeURIComponent(ref)}&w=1200`,
        alt: selectedPlace.name,
        type: 'exterior' as const,
      }))
    const result = await registerOwnerPlaceAction({
      name: selectedPlace.name,
      nameEn: nameEn || undefined,
      slug: slug || undefined,
      city,
      category,
      address: selectedPlace.address || '',
      latitude: selectedPlace.latitude,
      longitude: selectedPlace.longitude,
      phone: phone || undefined,
      openingHours: hoursArray.length > 0 ? hoursArray : undefined,
      description: description || undefined,
      tags,
      recommendedFor,
      strengths,
      services: services.filter((s) => s.name.trim()),
      faqs: faqs.filter((f) => f.question.trim() && f.answer.trim()),
      images: images.length > 0 ? images : undefined,
      naverPlaceUrl: naverPlaceUrl || undefined,
      kakaoMapUrl: kakaoMapUrl || undefined,
      googleBusinessUrl: googleBusinessUrl || undefined,
      homepageUrl: homepageUrl || undefined,
      blogUrl: blogUrl || undefined,
      instagramUrl: instagramUrl || undefined,
      googlePlaceId: isNaverOnly ? undefined : selectedPlace.placeId,
      rating: selectedPlace.rating,
      reviewCount: selectedPlace.reviewCount,
    })
    setLoading(false)
    if (result.success) {
      const msg = result.autoApproved
        ? '등록 완료 — 바로 공개됩니다.'
        : '등록 완료 — 관리자 검토 후 공개됩니다.'
      router.push(`/owner?registered=1&msg=${encodeURIComponent(msg)}`)
      router.refresh()
    } else {
      setError(result.error)
    }
  }

  function handleReset() {
    setSelectedPlace(null)
    setNaverResults([])
    setQuery('')
    setError(null)
  }

  // chip helpers
  function addChip(list: string[], setList: (v: string[]) => void, value: string, max: number) {
    const v = value.trim()
    if (!v || list.includes(v) || list.length >= max) return
    setList([...list, v])
  }

  const descLen = description.length
  const descValid = descLen >= 80 && descLen <= 160

  // ── 렌더 ────────────────────────────────────────────────────────────
  return (
    <>
      <div className="steps-nav">
        <StepPill n={1} label="업체 검색" current={currentStep} />
        <StepPill n={2} label="후보 선택" current={currentStep} />
        <StepPill n={3} label="정보 수정" current={currentStep} />
        <StepPill n={4} label="등록" current={currentStep} />
      </div>

      {error && <div className="pl-info err" role="alert">⚠️ {error}</div>}

      <form className="pl-form" onSubmit={(e) => { e.preventDefault(); handleSubmit() }}>

        {/* ========== SEARCH ========== */}
        <section className="pl-sec">
          <div className="pl-sec-head">
            <div>
              <div className="eyebrow">Step 1</div>
              <h3>업체명 검색</h3>
            </div>
          </div>
          <div className="pl-search">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleSearch())}
              placeholder="예: 천안 차앤박피부과, 서울 강남 홍길동치과"
              autoFocus
              disabled={!!selectedPlace}
            />
            <button type="button" onClick={handleSearch} disabled={loading || !!selectedPlace}>
              {loading ? '검색 중…' : '검색'}
            </button>
          </div>
          <p className="hint" style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)' }}>
            네이버 플레이스에서 찾고, Google 에서 자동으로 정보를 가져옵니다.
          </p>

          {/* 후보 결과 */}
          {!selectedPlace && naverResults.length > 0 && (
            <div className="candidate-list">
              {naverResults.map((c, idx) => {
                const disabled = c.alreadyRegistered != null
                return (
                  <div
                    key={`${c.naverPlaceUrl}-${idx}`}
                    className={`candidate-card${disabled ? ' disabled' : ''}`}
                    onClick={() => !disabled && handleSelectNaver(c)}
                    role={disabled ? undefined : 'button'}
                    tabIndex={disabled ? -1 : 0}
                  >
                    <div className="row-1">
                      <b>{c.displayName}</b>
                      {disabled
                        ? <span className="chip bad">이미 등록됨</span>
                        : <span className="chip good">naver</span>}
                      {c.naverCategory && <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{c.naverCategory}</span>}
                    </div>
                    <div className="addr">{c.roadAddress ?? c.jibunAddress}</div>
                    {disabled && c.alreadyRegistered ? (
                      <div style={{ marginTop: 8, display: 'flex', gap: 12, fontSize: 12.5 }}>
                        <a
                          href={`/${c.alreadyRegistered.city}/${c.alreadyRegistered.category}/${c.alreadyRegistered.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          style={{ color: 'var(--accent)', fontFamily: 'var(--mono)' }}
                        >
                          → 등록된 업체 보기
                        </a>
                        <span style={{ color: 'var(--muted-2)' }}>|</span>
                        <ClaimPlaceButton
                          placeId={c.alreadyRegistered.id}
                          placeName={c.alreadyRegistered.name}
                        />
                      </div>
                    ) : (
                      <div className="detect">
                        {c.detectedCategorySlug ? (
                          <span>
                            🏷️ <b>{categories.find((x) => x.slug === c.detectedCategorySlug)?.name ?? c.detectedCategorySlug}</b>
                            <span style={{ opacity: 0.6, marginLeft: 4 }}>{(c.detectedCategoryConfidence * 100).toFixed(0)}%</span>
                          </span>
                        ) : (
                          <span style={{ color: 'var(--warn)' }}>⚠️ 업종 수동 확인</span>
                        )}
                        {c.detectedCitySlug ? (
                          <span>📍 <b>{cities.find((x) => x.slug === c.detectedCitySlug)?.name ?? c.detectedCitySlug}</b></span>
                        ) : (
                          <span style={{ color: 'var(--warn)' }}>⚠️ 도시 수동 확인</span>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {!selectedPlace && naverResults.length === 0 && query.length > 0 && !loading && (
            <div className="pl-info warn" style={{ marginTop: 12 }}>
              <b>네이버 플레이스에 없는 업체는 등록 불가</b> 입니다.
              먼저{' '}
              <a href="https://smartplace.naver.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>
                네이버 스마트플레이스
              </a>
              {' '}또는{' '}
              <a href="https://www.google.com/business" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>
                Google Business Profile
              </a>
              {' '}에 등록 후 다시 검색해 주세요.
            </div>
          )}
        </section>

        {selectedPlace && (
          <>
            {/* ========== SELECTED ========== */}
            <section className="pl-sec">
              <div className="pl-sec-head">
                <div>
                  <div className="eyebrow">선택된 업체</div>
                  <h3>{selectedPlace.name}</h3>
                </div>
                <button type="button" className="back" onClick={handleReset} style={{ padding: '6px 12px', fontSize: 12 }}>
                  다시 선택
                </button>
              </div>
              <div className="pl-info ok">
                {selectedPlace.address}
                {selectedPlace.rating != null && ` · ★ ${selectedPlace.rating} (${selectedPlace.reviewCount ?? 0})`}
              </div>

              {/* 도시/업종 */}
              <div className="pe-field" style={{ marginTop: 16 }}>
                <label>자동 분류 — 틀리면 수정</label>
                <div className="row-2">
                  <div>
                    <label style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4, display: 'block' }}>도시</label>
                    <select className="pe-inp" value={city} onChange={(e) => setCity(e.target.value)}>
                      {cities.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="cat-picker">
                    <label style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4, display: 'block' }}>업종</label>
                    <input
                      className="pe-inp"
                      type="text"
                      value={catSearch}
                      onChange={(e) => { setCatSearch(e.target.value); setCategory('') }}
                      placeholder={category ? (categories.find((c) => c.slug === category)?.name ?? '') : '검색하여 변경'}
                    />
                    {filteredCategories.length > 0 && catSearch && !category && (
                      <div className="suggest">
                        {filteredCategories.slice(0, 10).map((c) => (
                          <button
                            key={c.slug}
                            type="button"
                            onClick={() => { setCategory(c.slug); setCatSearch(c.name); setSelectedSector(c.sector) }}
                          >
                            {c.name} <span className="slug">{c.slug}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {category && (
                      <div className="confirmed">✓ {categories.find((c) => c.slug === category)?.name}</div>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* ========== AI CTA ========== */}
            <button
              type="button"
              className="ai-cta"
              onClick={handleAiGenerate}
              disabled={aiLoading}
            >
              <span className="sparkle">
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 2l2.4 5.6L20 10l-5.6 2.4L12 18l-2.4-5.6L4 10l5.6-2.4z" />
                </svg>
              </span>
              <span className="body">
                {aiLoading ? 'AI 가 작성 중…' : '소개 · 서비스 · FAQ · 태그 AI 자동 생성'}
                <small>Google 리뷰·영업시간 기반 초안 · 수정 가능</small>
              </span>
            </button>

            {/* ========== BASIC ========== */}
            <section className="pl-sec">
              <div className="pl-sec-head">
                <div>
                  <div className="eyebrow">Section 01</div>
                  <h3>기본 정보</h3>
                </div>
              </div>

              <div className="row-2">
                <div className="pe-field">
                  <label>영문 / 대체 이름</label>
                  <p className="hint">AI 자동 변환된 초안입니다. 수정 가능.</p>
                  <input
                    className="pe-inp"
                    type="text"
                    value={nameEn}
                    onChange={(e) => setNameEn(e.target.value)}
                    placeholder="예: Cleanhue Clinic"
                  />
                </div>
                <div className="pe-field">
                  <label>URL 슬러그 <span className="opt">자동</span></label>
                  <p className="hint">aiplace.kr/{city}/{category || '...'}/{slug || '...'}</p>
                  <input
                    className="pe-inp mono"
                    type="text"
                    value={slug}
                    onChange={(e) => setSlug(buildSlug(e.target.value))}
                    placeholder="cleanhue-clinic"
                    maxLength={40}
                  />
                </div>
              </div>

              <div className="pe-field">
                <label>소개 문구 <span className="opt">권장 80–160자 (2~3문장)</span></label>
                <p className="hint">
                  첫 문장에 <b>누가·어디서·무엇을 잘하는지</b>, 이어서 <b>이 업체만의 특징·강점</b> (장비·경력·시술 시그니처·동선) 을
                  1~2문장 더 쓰면 AI 인용률이 평균 2.8배 올라갑니다. 권장 범위일 뿐 강제하지 않습니다.
                </p>
                <textarea
                  className="pe-ta"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={400}
                  rows={5}
                />
                <div className={`count${descValid ? ' ok' : descLen > 0 && descLen < 40 ? ' warn' : ''}`}>
                  <span>{descLen}</span>자
                </div>
              </div>
            </section>

            {/* ========== CONTACT ========== */}
            <section className="pl-sec">
              <div className="pl-sec-head">
                <div>
                  <div className="eyebrow">Section 02</div>
                  <h3>연락처 · 영업시간</h3>
                </div>
              </div>

              <div className="pe-field">
                <label>대표 전화</label>
                <p className="hint">숫자만 입력하면 자동으로 하이픈이 붙습니다.</p>
                <input
                  className="pe-inp mono"
                  type="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(formatKoreanPhone(e.target.value))}
                  placeholder="041-123-4567"
                  maxLength={14}
                />
              </div>

              <div className="pe-field">
                <label>영업시간</label>
                <p className="hint">요일별로 선택하세요. Schema.org 포맷으로 저장되어 AI 가 정확히 인식합니다.</p>
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

            {/* ========== SERVICES ========== */}
            <section className="pl-sec">
              <div className="pl-sec-head">
                <div>
                  <div className="eyebrow">Section 03</div>
                  <h3>제공 서비스</h3>
                </div>
              </div>
              <p className="hint" style={{ marginBottom: 12 }}>
                서비스명 + 한 줄 설명 + 가격대. AI 자동 생성이 초안을 채워줍니다.
              </p>
              <div className="svc-list">
                {services.map((s, i) => (
                  <div className="svc" key={i}>
                    <span className="drag" aria-hidden="true" title="드래그">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <circle cx="9" cy="6" r="1.2" /><circle cx="15" cy="6" r="1.2" />
                        <circle cx="9" cy="12" r="1.2" /><circle cx="15" cy="12" r="1.2" />
                        <circle cx="9" cy="18" r="1.2" /><circle cx="15" cy="18" r="1.2" />
                      </svg>
                    </span>
                    <div className="sv-main">
                      <input
                        className="name"
                        aria-label="서비스명"
                        placeholder="서비스명 (예: 주택 인테리어)"
                        value={s.name}
                        onChange={(e) => {
                          const next = [...services]; next[i] = { ...next[i], name: e.target.value }; setServices(next)
                        }}
                      />
                      <input
                        className="desc"
                        aria-label="한 줄 설명"
                        placeholder="한 줄 설명"
                        value={s.description}
                        onChange={(e) => {
                          const next = [...services]; next[i] = { ...next[i], description: e.target.value }; setServices(next)
                        }}
                      />
                    </div>
                    <input
                      className="price"
                      aria-label="가격대"
                      placeholder="50-300만원"
                      value={s.priceRange}
                      onChange={(e) => {
                        const next = [...services]; next[i] = { ...next[i], priceRange: e.target.value }; setServices(next)
                      }}
                    />
                    <button
                      type="button"
                      className="x"
                      onClick={() => setServices(services.filter((_, j) => j !== i))}
                      title="삭제"
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

            {/* ========== FAQ ========== */}
            <section className="pl-sec">
              <div className="pl-sec-head">
                <div>
                  <div className="eyebrow">Section 04</div>
                  <h3>자주 묻는 질문</h3>
                </div>
              </div>
              <p className="hint" style={{ marginBottom: 12 }}>
                업체명으로 시작하는 질문 3~5개 권장 (AI 답변 인용률 ↑).
              </p>
              <div className="faq-list">
                {faqs.map((f, i) => (
                  <div className="faq" key={i}>
                    <button
                      type="button"
                      className="f-x"
                      onClick={() => setFaqs(faqs.filter((_, j) => j !== i))}
                      title="삭제" aria-label="FAQ 삭제"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                        <path d="M6 6l12 12M6 18L18 6" />
                      </svg>
                    </button>
                    <input
                      className="f-q"
                      aria-label="질문"
                      placeholder="Q. 업체명으로 시작하는 질문 (예: 영업시간은 어떻게 되나요?)"
                      value={f.question}
                      onChange={(e) => {
                        const next = [...faqs]; next[i] = { ...next[i], question: e.target.value }; setFaqs(next)
                      }}
                    />
                    <textarea
                      className="f-a"
                      aria-label="답변"
                      placeholder="A. 구어체 답변"
                      value={f.answer}
                      onChange={(e) => {
                        const next = [...faqs]; next[i] = { ...next[i], answer: e.target.value }; setFaqs(next)
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

            {/* ========== TAGS / RECOMMENDED / STRENGTHS ========== */}
            <section className="pl-sec">
              <div className="pl-sec-head">
                <div>
                  <div className="eyebrow">Section 05</div>
                  <h3>태그 · 추천 대상 · 강점</h3>
                </div>
              </div>
              <p className="hint" style={{ marginBottom: 12 }}>
                AI 가 &ldquo;어떤 사람에게 이 업체를 추천할까?&rdquo; 를 결정할 때 참고합니다.
              </p>

              <RegChipGroup
                label="태그" hint={`${tags.length} / 10개`}
                chips={tags} placeholder="태그 입력 후 Enter, 또는 쉼표"
                onAdd={(v) => addChip(tags, setTags, v, 10)}
                onRemove={(v) => setTags(tags.filter((t) => t !== v))}
              />
              <RegChipGroup
                label="추천 대상" hint={`${recommendedFor.length} / 6개`}
                chips={recommendedFor} placeholder="예: 신혼부부, 자영업자, 카페 오픈 예정"
                onAdd={(v) => addChip(recommendedFor, setRecommendedFor, v, 6)}
                onRemove={(v) => setRecommendedFor(recommendedFor.filter((t) => t !== v))}
              />
              <RegChipGroup
                label="강점" hint={strengths.length > 0 ? `${strengths.length}개` : '선택'}
                chips={strengths} placeholder="예: 20년 경력, 야간 진료, 면허 보유"
                onAdd={(v) => addChip(strengths, setStrengths, v, 8)}
                onRemove={(v) => setStrengths(strengths.filter((t) => t !== v))}
              />
            </section>

            {/* ========== LINKS ========== */}
            <section className="pl-sec">
              <div className="pl-sec-head">
                <div>
                  <div className="eyebrow">Section 06</div>
                  <h3>외부 포털 링크</h3>
                </div>
              </div>
              <p className="hint" style={{ marginBottom: 12 }}>
                Google, 네이버, 카카오 등 외부 포털에 이미 업체가 있다면 <b>실제 업체 페이지 URL</b> 을 붙여넣어 주세요.
                AI 가 여러 출처를 함께 읽을 때 신뢰도가 올라갑니다. 오른쪽 &ldquo;새창에서 찾기&rdquo; 버튼은 검색 페이지만 열어 줍니다.
              </p>
              <div className="row-2">
                <RegLinkField
                  label="네이버 플레이스" value={naverPlaceUrl} onChange={setNaverPlaceUrl}
                  placeholder="https://naver.me/... 또는 https://m.place.naver.com/..."
                  searchUrl={`https://map.naver.com/p/search/${encodeURIComponent(selectedPlace.name)}`}
                  searchLabel="네이버에서 찾기"
                />
                <RegLinkField
                  label="카카오맵" value={kakaoMapUrl} onChange={setKakaoMapUrl}
                  placeholder="https://place.map.kakao.com/..."
                  searchUrl={`https://map.kakao.com/?q=${encodeURIComponent(selectedPlace.name)}`}
                  searchLabel="카카오에서 찾기"
                />
                <RegLinkField
                  label="Google Business Profile" value={googleBusinessUrl} onChange={setGoogleBusinessUrl}
                  placeholder="https://maps.google.com/..."
                  searchUrl={`https://www.google.com/maps/search/${encodeURIComponent(selectedPlace.name)}`}
                  searchLabel="Google 에서 찾기"
                />
                <RegLinkField label="홈페이지" value={homepageUrl} onChange={setHomepageUrl} placeholder="https://example.com" />
                <RegLinkField label="블로그" value={blogUrl} onChange={setBlogUrl} placeholder="https://blog.naver.com/..." />
                <RegLinkField label="인스타그램" value={instagramUrl} onChange={setInstagramUrl} placeholder="@business_account" />
              </div>
            </section>

            {/* ========== PHOTOS ========== */}
            <section className="pl-sec">
              <div className="pl-sec-head">
                <div>
                  <div className="eyebrow">Section 07</div>
                  <h3>사진 <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--accent)', marginLeft: 6 }}>Google 자동</span></h3>
                </div>
              </div>
              {photoRefs.length === 0 ? (
                <div className="pl-info">
                  Google Places 에 사진이 없거나 매칭 실패. 등록 후 Google Business Profile 에 올리면 자동 반영됩니다.
                </div>
              ) : (
                <>
                  <div className="ph-grid">
                    {photoRefs.map((ref) => {
                      const checked = selectedPhotos.has(ref)
                      return (
                        <button
                          key={ref}
                          type="button"
                          className={`ph${checked ? ' selected' : ''}`}
                          onClick={() => {
                            setSelectedPhotos((prev) => {
                              const next = new Set(prev)
                              if (next.has(ref)) next.delete(ref)
                              else next.add(ref)
                              return next
                            })
                          }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={`/api/places/photo?ref=${encodeURIComponent(ref)}&w=400`}
                            alt=""
                            loading="lazy"
                          />
                        </button>
                      )
                    })}
                  </div>
                  <p className="hint" style={{ marginTop: 8 }}>
                    {selectedPhotos.size} / {photoRefs.length} 장 선택됨. 체크 해제한 사진은 페이지에 노출되지 않습니다.
                  </p>
                </>
              )}
            </section>

            {/* Submit */}
            <div className="pl-actions">
              <Link href="/owner/places" className="back">← 업체 목록</Link>
              <button
                type="submit"
                disabled={loading}
                className="submit"
              >
                {loading ? '등록 중…' : '업체 등록 →'}
              </button>
            </div>
          </>
        )}
      </form>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────
// 보조 컴포넌트 (pe-* chip / link-field 와 동일 UX)
// ─────────────────────────────────────────────────────────────────────

interface RegChipGroupProps {
  label: string; hint: string; chips: string[]; placeholder: string
  onAdd: (v: string) => void; onRemove: (v: string) => void
}

function RegChipGroup({ label, hint, chips, placeholder, onAdd, onRemove }: RegChipGroupProps) {
  const [input, setInput] = useState('')
  function commit(value: string) {
    const v = value.trim().replace(/,$/, '')
    if (!v) return
    onAdd(v); setInput('')
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
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commit(input) }
            else if (e.key === 'Backspace' && !input && chips.length > 0) onRemove(chips[chips.length - 1])
          }}
          onBlur={() => { if (input) commit(input) }}
          placeholder={placeholder}
        />
      </div>
    </div>
  )
}

interface RegLinkFieldProps {
  label: string; value: string; onChange: (v: string) => void; placeholder: string
  searchUrl?: string; searchLabel?: string
}

function RegLinkField({ label, value, onChange, placeholder, searchUrl, searchLabel }: RegLinkFieldProps) {
  const connected = value.trim().length > 0
  return (
    <div className="pe-field">
      <div className="link-label-row">
        <label>{label}</label>
        {searchUrl && (
          <a href={searchUrl} target="_blank" rel="noopener noreferrer" className="link-search">
            {searchLabel ?? '새창에서 찾기'} ↗
          </a>
        )}
      </div>
      <div className="link-field">
        <input
          type="url"
          className="pe-inp mono"
          value={value}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
          placeholder={placeholder}
          style={{ paddingLeft: 14 }}
        />
        <span className={`stat ${connected ? 'ok' : 'empty'}`}>{connected ? '연결됨' : '미연결'}</span>
      </div>
    </div>
  )
}

function StepPill({ n, label, current }: { n: number; label: string; current: number }) {
  const state = current > n ? 'done' : current === n ? 'cur' : ''
  return (
    <div className={`st ${state}`.trim()}>
      <span className="i">STEP {String(n).padStart(2, '0')}</span>
      <b>{label}</b>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// 헬퍼
// ─────────────────────────────────────────────────────────────────────

function updateHoursDay(
  setter: React.Dispatch<React.SetStateAction<HoursMap>>,
  day: DayCode,
  patch: Partial<HoursMap[DayCode]>,
) {
  setter((prev) => ({ ...prev, [day]: { ...prev[day], ...patch } }))
}

/**
 * slug 정규화 공통 로직.
 * - 소문자화 → 공백·비허용 문자를 하이픈으로 → 연속 하이픈 1개로 → 양 끝 하이픈 제거
 * - 40자 cap (너무 길면 AI·검색 URL 미리보기에서 잘림)
 */
function buildSlug(source: string, maxLen = 40): string {
  return source
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, maxLen)
    .replace(/-$/g, '') // cap 직후 끝이 하이픈이면 제거
}

/**
 * Google Places 의 한글 요일 설명("월요일 9시~18시 · ...") 을 Schema.org 약어 배열로 변환.
 * 기존 구현의 인라인 파서를 분리.
 */
function convertGoogleHoursToSchemaOrg(rows: string[]): string[] {
  const dayMap: Record<string, string> = {
    '월요일': 'Mo', '화요일': 'Tu', '수요일': 'We',
    '목요일': 'Th', '금요일': 'Fr', '토요일': 'Sa', '일요일': 'Su',
  }
  const out: string[] = []
  for (const line of rows) {
    const dayKey = Object.keys(dayMap).find((k) => line.startsWith(k))
    if (!dayKey) continue
    const code = dayMap[dayKey]
    if (line.includes('휴무') || line.includes('정기휴무')) continue
    const match = line.match(/(\d{1,2}):(\d{2})\s*[~-]\s*.*?(\d{1,2}):(\d{2})/)
    if (!match) continue
    const [, h1, m1, h2, m2] = match
    // '오후' 가 라인에 없으면 indexOf = -1. -1 < any-non-negative 가 true 로 평가되어
    // AM-only / 24h 라인이 +12 시프트되던 버그(bug_007) 방지 — >= 0 가드 필수.
    const openIdx = line.indexOf('오후')
    const openH = openIdx >= 0 && openIdx < line.indexOf(h1) && parseInt(h1, 10) < 12
      ? String(parseInt(h1, 10) + 12).padStart(2, '0')
      : h1.padStart(2, '0')
    const closeIdx = line.lastIndexOf('오후')
    const closeH = closeIdx >= 0 && closeIdx > line.indexOf(h1) && parseInt(h2, 10) < 12
      ? String(parseInt(h2, 10) + 12).padStart(2, '0')
      : h2.padStart(2, '0')
    out.push(`${code} ${openH}:${m1}-${closeH}:${m2}`)
  }
  return out
}
