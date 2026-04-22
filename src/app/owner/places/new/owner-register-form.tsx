'use client'

// T-201 — Owner 업체 등록 폼 (docs/AIPLACE/register.html 디자인).
// 플로우 (로직 기존 유지):
//   1) 업체명 검색 (네이버 지역) → 후보 카드
//   2) 후보 선택 → Google enrich (평점·리뷰·영업시간·사진)
//   3) 상세 수정 + AI 자동 생성 → 등록
//
// className 은 aip.css + owner-dashboard.css 토큰 (form-card, field, grid-2, chip-picker, …).

import { useState, type ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  searchPlaceByNaver,
  enrichFromGoogle,
  generatePlaceContent,
  type NaverCandidate,
} from '@/lib/actions/register-place'
import { registerOwnerPlaceAction } from '@/lib/actions/owner-register-place'
import type { PlaceSearchResult } from '@/lib/google-places'
import { ClaimPlaceButton } from '@/components/business/claim-place-button'

const TIME_OPTIONS = Array.from({ length: 33 }, (_, i) => {
  const h = Math.floor(i / 2) + 7
  const m = i % 2 === 0 ? '00' : '30'
  return `${String(h).padStart(2, '0')}:${m}`
})

function TimeSelect({ value, onChange, ariaLabel }: { value: string; onChange: (v: string) => void; ariaLabel: string }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={ariaLabel}>
      <option value="">--:--</option>
      {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
    </select>
  )
}

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
  const [hours, setHours] = useState([
    { day: 'Mo', label: '월', open: '', close: '', closed: false },
    { day: 'Tu', label: '화', open: '', close: '', closed: false },
    { day: 'We', label: '수', open: '', close: '', closed: false },
    { day: 'Th', label: '목', open: '', close: '', closed: false },
    { day: 'Fr', label: '금', open: '', close: '', closed: false },
    { day: 'Sa', label: '토', open: '', close: '', closed: false },
    { day: 'Su', label: '일', open: '', close: '', closed: true },
  ])
  const [naverPlaceUrl, setNaverPlaceUrl] = useState('')
  const [kakaoMapUrl, setKakaoMapUrl] = useState('')
  const [enrichedReviews, setEnrichedReviews] = useState<Array<{ text: string; rating: number }>>([])
  const [enrichedData, setEnrichedData] = useState<{ openingHours?: string[]; editorialSummary?: string } | null>(null)
  const [services, setServices] = useState([{ name: '', description: '', priceRange: '' }])
  const [faqs, setFaqs] = useState([
    { question: '', answer: '' },
    { question: '', answer: '' },
    { question: '', answer: '' },
  ])
  const [tags, setTags] = useState('')
  const [photoRefs, setPhotoRefs] = useState<string[]>([])
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set())

  const currentStep: Step =
    !selectedPlace && naverResults.length === 0 && !loading ? 1 :
    !selectedPlace && (naverResults.length > 0 || loading) ? 2 :
    selectedPlace ? 3 : 1

  // ── 액션 ─────────────────────────────────────────────────────────
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
    if (c.phone) setPhone(c.phone)
    setNaverPlaceUrl(c.naverPlaceUrl)
    if (c.latitude && c.longitude) {
      setKakaoMapUrl(`https://map.kakao.com/link/map/${encodeURIComponent(c.displayName)},${c.latitude},${c.longitude}`)
    } else {
      setKakaoMapUrl(`https://map.kakao.com/link/search/${encodeURIComponent(c.displayName)}`)
    }

    const slugCandidate = c.displayName
      .replace(/\s+/g, '-').toLowerCase()
      .replace(/[^a-z0-9-가-힣]/g, '')
      .replace(/-+/g, '-').replace(/^-|-$/g, '')
    setSlug(slugCandidate.slice(0, 100) || `${c.detectedCategorySlug ?? 'place'}-${Date.now().toString(36).slice(-4)}`)

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
    if (d.nameEn) setNameEn(d.nameEn)
    if (d.phone && !c.phone) setPhone(d.phone)
    if (d.openingHours) {
      const dayMap: Record<string, string> = { '월요일': 'Mo', '화요일': 'Tu', '수요일': 'We', '목요일': 'Th', '금요일': 'Fr', '토요일': 'Sa', '일요일': 'Su' }
      setHours((prev) => prev.map((h) => {
        const line = d.openingHours?.find((l) => {
          const dayKr = Object.entries(dayMap).find(([, v]) => v === h.day)?.[0]
          return dayKr && l.startsWith(dayKr)
        })
        if (!line) return { ...h, closed: true, open: '', close: '' }
        if (line.includes('휴무')) return { ...h, closed: true, open: '', close: '' }
        const timeMatch = line.match(/(\d{1,2}:\d{2})\s*~\s*.*?(\d{1,2}:\d{2})/)
        if (!timeMatch) return h
        const rawOpen = timeMatch[1]
        const rawClose = timeMatch[2]
        const openTime = line.indexOf('오후') < line.indexOf(rawOpen) && parseInt(rawOpen) < 12
          ? `${parseInt(rawOpen) + 12}:${rawOpen.split(':')[1]}`
          : rawOpen.padStart(5, '0')
        const closeIdx = line.lastIndexOf('오후')
        const closeTime = closeIdx > line.indexOf(rawOpen) && parseInt(rawClose) < 12
          ? `${parseInt(rawClose) + 12}:${rawClose.split(':')[1]}`
          : rawClose.padStart(5, '0')
        return { ...h, closed: false, open: openTime, close: closeTime }
      }))
    }
    if (d.reviews) setEnrichedReviews(d.reviews)
    setEnrichedData({ openingHours: d.openingHours, editorialSummary: d.editorialSummary })
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
    const result = await generatePlaceContent({
      name: selectedPlace.name,
      category,
      address: selectedPlace.address,
      rating: selectedPlace.rating,
      reviewCount: selectedPlace.reviewCount,
      reviews: enrichedReviews,
      openingHours: enrichedData?.openingHours,
      editorialSummary: enrichedData?.editorialSummary,
    })
    setAiLoading(false)
    if (result.success) {
      if (result.data.description) setDescription(result.data.description)
      setServices(result.data.services)
      setFaqs(result.data.faqs)
      setTags(result.data.tags.join(', '))
    } else {
      setError(result.error)
    }
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
    const hoursArray = hours.filter((h) => !h.closed && h.open && h.close).map((h) => `${h.day} ${h.open}-${h.close}`)
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
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      services: services.filter((s) => s.name.trim()),
      faqs: faqs.filter((f) => f.question.trim() && f.answer.trim()),
      images: images.length > 0 ? images : undefined,
      naverPlaceUrl: naverPlaceUrl || undefined,
      kakaoMapUrl: kakaoMapUrl || undefined,
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

  // ── 렌더 ──────────────────────────────────────────────────────────
  return (
    <>
      <div className="steps-nav">
        <StepPill n={1} label="업체 검색" current={currentStep} />
        <StepPill n={2} label="후보 선택" current={currentStep} />
        <StepPill n={3} label="정보 수정" current={currentStep} />
        <StepPill n={4} label="등록" current={currentStep} />
      </div>

      {error && <div className="form-inline-error" role="alert">{error}</div>}

      <form className="form-card" onSubmit={(e) => { e.preventDefault(); handleSubmit() }}>
        {/* ── STEP 1: 검색 ────────────────────────────────────────── */}
        <div className="field">
          <label className="lbl" htmlFor="biz-search">
            업체명 + 지역 <span style={{ color: 'var(--accent)' }}>*</span>
          </label>
          <div className="hint">네이버 플레이스에서 찾고, Google 에서 자동으로 정보를 가져옵니다.</div>
          <div className="search-row">
            <input
              id="biz-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleSearch())}
              placeholder="예: 천안 차앤박피부과, 서울 강남 홍길동치과"
              autoFocus
              disabled={!!selectedPlace}
            />
            <button
              type="button"
              onClick={handleSearch}
              disabled={loading || !!selectedPlace}
              className="btn accent"
            >
              {loading ? '검색 중…' : '검색'}
            </button>
          </div>
        </div>

        {/* STEP 2: 후보 카드 */}
        {!selectedPlace && naverResults.length > 0 && (
          <div className="field">
            <label className="lbl">후보 {naverResults.length}곳</label>
            <div className="hint">업체명을 클릭하면 Google 에서 자동으로 평점·리뷰·영업시간을 가져옵니다.</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
                        ? <span className="chip" style={{ background: 'color-mix(in oklab, #c24b2f 12%, transparent)', color: '#9a2c00' }}>이미 등록됨</span>
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
          </div>
        )}

        {!selectedPlace && naverResults.length === 0 && query.length > 0 && !loading && (
          <div className="form-inline-info">
            <b style={{ color: 'var(--ink)' }}>네이버 플레이스에 없는 업체는 등록 불가</b>입니다.
            <div style={{ marginTop: 6, fontSize: 12 }}>
              먼저{' '}
              <a href="https://smartplace.naver.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>
                네이버 스마트플레이스
              </a>
              {' '}또는{' '}
              <a href="https://www.google.com/business" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>
                Google Business Profile
              </a>
              {' '}에 업체를 등록하신 후 다시 검색해 주세요.
            </div>
          </div>
        )}

        {/* STEP 3: 선택 후 자동 채움 ─────────────────────────────── */}
        {selectedPlace && (
          <>
            <div className="form-inline-info" style={{ marginBottom: 20 }}>
              <b style={{ color: 'var(--ink)' }}>선택: {selectedPlace.name}</b>
              {' '}· {selectedPlace.address}
              {selectedPlace.rating != null && ` · ★ ${selectedPlace.rating}`}
              {' '}
              <button type="button" onClick={handleReset} className="btn ghost sm" style={{ marginLeft: 10 }}>
                변경
              </button>
            </div>

            <div className="field">
              <label className="lbl">자동 분류 결과 (필요시 수정)</label>
              <div className="grid-2">
                <div>
                  <label className="lbl" htmlFor="f-city" style={{ fontSize: 12 }}>도시</label>
                  <select id="f-city" value={city} onChange={(e) => setCity(e.target.value)}>
                    {cities.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="lbl" htmlFor="f-cat" style={{ fontSize: 12 }}>업종</label>
                  <input
                    id="f-cat"
                    type="text"
                    value={catSearch}
                    onChange={(e) => { setCatSearch(e.target.value); setCategory('') }}
                    placeholder={category ? (categories.find((c) => c.slug === category)?.name ?? '') : '검색하여 변경'}
                  />
                  {filteredCategories.length > 0 && catSearch && !category && (
                    <div style={{
                      marginTop: 6, maxHeight: 140, overflowY: 'auto',
                      border: '1px solid var(--line-2)', borderRadius: 8, background: 'var(--card)',
                    }}>
                      {filteredCategories.slice(0, 10).map((c) => (
                        <button
                          key={c.slug}
                          type="button"
                          onClick={() => { setCategory(c.slug); setCatSearch(c.name); setSelectedSector(c.sector) }}
                          style={{
                            display: 'block', width: '100%', textAlign: 'left',
                            padding: '8px 12px', fontSize: 13, background: 'transparent',
                            border: 'none', cursor: 'pointer', color: 'var(--ink)',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-2)')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        >
                          {c.name} <span style={{ color: 'var(--muted-2)', fontFamily: 'var(--mono)' }}>({c.slug})</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {category && (
                    <div style={{ marginTop: 4, fontSize: 12, color: 'var(--good)', fontFamily: 'var(--mono)' }}>
                      ✓ {categories.find((c) => c.slug === category)?.name}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleAiGenerate}
              disabled={aiLoading}
              className="btn accent lg"
              style={{ width: '100%', marginBottom: 20 }}
            >
              {aiLoading ? 'AI 생성 중…' : '✨ 소개 · 서비스 · FAQ · 태그 AI 자동 생성'}
            </button>

            <div className="grid-2">
              <div className="field">
                <label className="lbl" htmlFor="f-name-en">영문 이름 <span style={{ color: 'var(--muted)', fontSize: 11 }}>(자동)</span></label>
                <input id="f-name-en" type="text" value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
              </div>
              <div className="field">
                <label className="lbl" htmlFor="f-slug">URL 슬러그 <span style={{ color: 'var(--muted)', fontSize: 11 }}>(자동)</span></label>
                <input id="f-slug" type="text" value={slug} onChange={(e) => setSlug(e.target.value)} />
                <div className="hint" style={{ marginTop: 4 }}>
                  aiplace.kr/{city}/{category || '...'}/{slug || '...'}
                </div>
              </div>
            </div>

            <div className="field">
              <label className="lbl" htmlFor="f-desc">
                소개
                {' '}<span style={{ fontSize: 11, color: description.length >= 40 && description.length <= 60 ? 'var(--good)' : 'var(--muted)', fontFamily: 'var(--mono)' }}>
                  {description.length}/60자 권장
                </span>
              </label>
              <div className="hint">AI 가 인용하기 좋은 문장: 구체적인 숫자·경력·자격.</div>
              <textarea id="f-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={100} rows={3} />
            </div>

            <div className="field">
              <label className="lbl">영업시간 <span className="chip good" style={{ fontSize: 10.5, padding: '1px 7px', marginLeft: 6 }}>Google 자동</span></label>
              <div className="hours-list">
                {hours.map((h, i) => (
                  <div key={h.day} className="hours-row">
                    <span className="d">{h.label}</span>
                    <label className="closed-lbl">
                      <input
                        type="checkbox"
                        checked={h.closed}
                        onChange={(e) => {
                          const next = [...hours]
                          next[i] = { ...next[i], closed: e.target.checked }
                          setHours(next)
                        }}
                      />
                      <span>휴무</span>
                    </label>
                    {!h.closed && (
                      <>
                        <TimeSelect
                          value={h.open}
                          onChange={(val) => setHours((prev) => prev.map((item, j) => j === i ? { ...item, open: val } : item))}
                          ariaLabel={`${h.label} 오픈`}
                        />
                        <span style={{ color: 'var(--muted)' }}>~</span>
                        <TimeSelect
                          value={h.close}
                          onChange={(val) => setHours((prev) => prev.map((item, j) => j === i ? { ...item, close: val } : item))}
                          ariaLabel={`${h.label} 마감`}
                        />
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid-2">
              <div className="field">
                <label className="lbl" htmlFor="f-phone">전화번호</label>
                <input id="f-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div className="field">
                <label className="lbl" htmlFor="f-kakao">카카오맵 URL</label>
                <input id="f-kakao" type="url" value={kakaoMapUrl} onChange={(e) => setKakaoMapUrl(e.target.value)} />
              </div>
            </div>

            <div className="field">
              <label className="lbl" htmlFor="f-naver">네이버 플레이스 URL</label>
              <input id="f-naver" type="url" value={naverPlaceUrl} onChange={(e) => setNaverPlaceUrl(e.target.value)} />
            </div>

            <div className="field">
              <label className="lbl">서비스</label>
              <div className="hint">서비스명 · 설명 · 가격대. AI 자동 생성에서 초안이 들어옵니다.</div>
              {services.map((s, i) => (
                <div key={i} className="grid-3" style={{ marginBottom: 8 }}>
                  <input placeholder="서비스명" value={s.name} onChange={(e) => { const next = [...services]; next[i] = { ...next[i], name: e.target.value }; setServices(next) }} />
                  <input placeholder="설명" value={s.description} onChange={(e) => { const next = [...services]; next[i] = { ...next[i], description: e.target.value }; setServices(next) }} />
                  <input placeholder="가격대" value={s.priceRange} onChange={(e) => { const next = [...services]; next[i] = { ...next[i], priceRange: e.target.value }; setServices(next) }} />
                </div>
              ))}
              <button
                type="button"
                onClick={() => setServices([...services, { name: '', description: '', priceRange: '' }])}
                className="btn ghost sm"
              >
                + 서비스 추가
              </button>
            </div>

            <div className="field">
              <label className="lbl">FAQ</label>
              <div className="hint">업체명으로 시작하는 질문 3~5개 권장 (AI 답변 인용률 ↑).</div>
              {faqs.map((f, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                  <input
                    placeholder="질문 (업체명 포함 · ?로 끝)"
                    value={f.question}
                    onChange={(e) => { const next = [...faqs]; next[i] = { ...next[i], question: e.target.value }; setFaqs(next) }}
                  />
                  <input
                    placeholder="답변"
                    value={f.answer}
                    onChange={(e) => { const next = [...faqs]; next[i] = { ...next[i], answer: e.target.value }; setFaqs(next) }}
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={() => setFaqs([...faqs, { question: '', answer: '' }])}
                className="btn ghost sm"
              >
                + FAQ 추가
              </button>
            </div>

            <div className="field">
              <label className="lbl" htmlFor="f-tags">태그</label>
              <div className="hint">쉼표로 구분 · 예: 여드름, 레이저, 보톡스</div>
              <input id="f-tags" type="text" value={tags} onChange={(e) => setTags(e.target.value)} />
            </div>

            <div className="field">
              <label className="lbl">사진 <span className="chip good" style={{ fontSize: 10.5, padding: '1px 7px', marginLeft: 6 }}>Google 자동</span></label>
              {photoRefs.length === 0 ? (
                <div className="form-inline-info">
                  Google Places 에 사진이 없거나 매칭 실패했습니다. 업체 등록 후 Google Business Profile 에 사진을 올리면 자동 반영됩니다.
                </div>
              ) : (
                <>
                  <div className="photo-grid">
                    {photoRefs.map((ref) => {
                      const checked = selectedPhotos.has(ref)
                      return (
                        <label key={ref} className={checked ? 'sel' : undefined}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => {
                              setSelectedPhotos((prev) => {
                                const next = new Set(prev)
                                if (e.target.checked) next.add(ref)
                                else next.delete(ref)
                                return next
                              })
                            }}
                          />
                          { /* eslint-disable-next-line @next/next/no-img-element */ }
                          <img
                            src={`/api/places/photo?ref=${encodeURIComponent(ref)}&w=400`}
                            alt=""
                            loading="lazy"
                          />
                        </label>
                      )
                    })}
                  </div>
                  <div className="hint" style={{ marginTop: 8 }}>
                    {selectedPhotos.size} / {photoRefs.length} 장 선택됨. 체크 해제한 사진은 페이지에 노출되지 않습니다.
                  </div>
                </>
              )}
            </div>
          </>
        )}

        {/* Actions */}
        {selectedPlace && (
          <div className="actions-row">
            <Link href="/owner" className="btn ghost">← 대시보드로</Link>
            <button
              type="submit"
              disabled={loading}
              className="btn accent lg"
            >
              {loading ? '등록 중…' : '업체 등록 →'}
            </button>
          </div>
        )}
      </form>
    </>
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
