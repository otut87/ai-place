'use client'

// Owner 업체 등록 — admin/register 와 동일한 UX (검색 → 선택 → 자동채움 → 수정 → 저장).
// 단계별 마법사 제거. 로그인한 사장이 본인 업체를 직접 등록.
import { useState } from 'react'
import { useRouter } from 'next/navigation'
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

function TimeSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} className="h-8 px-2 rounded border border-[#dddddd] text-sm">
      <option value="">--:--</option>
      {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
    </select>
  )
}

interface Props {
  cities: Array<{ slug: string; name: string }>
  categories: Array<{ slug: string; name: string; sector: string }>
}

export function OwnerRegisterForm({ cities, categories }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [selectedSector, setSelectedSector] = useState('')
  const [catSearch, setCatSearch] = useState('')
  const filteredCategories = categories.filter(c => {
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
  // Google Places photoRefs (API 키 없이 /api/places/photo 프록시로 렌더).
  // 기본으로 전체 선택, 필요시 체크 해제.
  const [photoRefs, setPhotoRefs] = useState<string[]>([])
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set())

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
    if (c.detectedCitySlug && cities.some(x => x.slug === c.detectedCitySlug)) {
      setCity(c.detectedCitySlug)
    }
    if (c.detectedCategorySlug && categories.some(x => x.slug === c.detectedCategorySlug)) {
      setCategory(c.detectedCategorySlug)
      const cat = categories.find(x => x.slug === c.detectedCategorySlug)
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
    // 카카오맵 딥링크 — 이름 + 좌표로 결정론적 생성 (REST API 불필요).
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
    setSelectedPlace(prev => prev ? {
      ...prev,
      placeId: d.googlePlaceId ?? 'naver',
      rating: d.rating,
      reviewCount: d.reviewCount,
    } : prev)
    if (d.nameEn) setNameEn(d.nameEn)
    if (d.phone && !c.phone) setPhone(d.phone)
    if (d.openingHours) {
      const dayMap: Record<string, string> = { '월요일': 'Mo', '화요일': 'Tu', '수요일': 'We', '목요일': 'Th', '금요일': 'Fr', '토요일': 'Sa', '일요일': 'Su' }
      setHours(prev => prev.map(h => {
        const line = d.openingHours?.find(l => {
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
    // Google 사진 레퍼런스 — 기본 전체 선택.
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
    const hoursArray = hours.filter(h => !h.closed && h.open && h.close).map(h => `${h.day} ${h.open}-${h.close}`)
    // Google photoRefs → 프록시 URL 변환. 업체명을 alt 로 사용.
    const images = [...selectedPhotos]
      .filter(ref => photoRefs.includes(ref))
      .map(ref => ({
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
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      services: services.filter(s => s.name.trim()),
      faqs: faqs.filter(f => f.question.trim() && f.answer.trim()),
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

  return (
    <div>
      {error && <p className="mb-4 text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}

      {/* 검색 */}
      <div className="space-y-4 mb-8">
        <div>
          <label className="block text-sm font-medium text-[#484848] mb-1">업체명 + 지역 검색</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="예: 천안 차앤박피부과, 서울 강남 홍길동치과"
              className="flex-1 h-12 px-4 rounded-lg border border-[#dddddd]"
              autoFocus
            />
            <button onClick={handleSearch} disabled={loading} className="h-12 px-6 rounded-lg bg-[#008060] text-white font-medium disabled:opacity-50">
              {loading ? '검색 중...' : '검색'}
            </button>
          </div>
          <p className="mt-2 text-xs text-[#8a8a8a]">
            네이버 지역 검색에서 업체를 찾으면 Google 평점·리뷰·영업시간이 자동으로 채워집니다.
            네이버에 없다면 &ldquo;주소로 직접 등록&rdquo;.
          </p>
        </div>

        {naverResults.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm text-[#6a6a6a]">{naverResults.length}개 후보</p>
            {naverResults.map((c, idx) => {
              const disabled = c.alreadyRegistered != null
              return (
                <div
                  key={`${c.naverPlaceUrl}-${idx}`}
                  className={`w-full text-left p-4 rounded-lg border transition-colors ${
                    disabled
                      ? 'border-[#dddddd] bg-[#fafafa] opacity-80'
                      : 'border-[#dddddd] hover:border-[#008060] cursor-pointer'
                  }`}
                  onClick={() => { if (!disabled) handleSelectNaver(c) }}
                  role={disabled ? undefined : 'button'}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={`font-medium ${disabled ? 'text-[#8a8a8a]' : 'text-[#222222]'}`}>{c.displayName}</p>
                    {disabled ? (
                      <span className="px-1.5 py-0.5 text-[10px] rounded bg-[#fee2e2] text-[#991b1b] font-medium">이미 등록됨</span>
                    ) : (
                      <span className="px-1.5 py-0.5 text-[10px] rounded bg-[#e6f7f2] text-[#008060] font-medium">naver</span>
                    )}
                    {c.naverCategory && (
                      <span className="text-xs text-[#8a8a8a]">{c.naverCategory}</span>
                    )}
                  </div>
                  <p className="text-sm text-[#6a6a6a] mt-1">{c.roadAddress ?? c.jibunAddress}</p>
                  {disabled && c.alreadyRegistered ? (
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                      <a
                        href={`/${c.alreadyRegistered.city}/${c.alreadyRegistered.category}/${c.alreadyRegistered.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#4c1d95] underline"
                        onClick={e => e.stopPropagation()}
                      >
                        → 등록된 업체 보기
                      </a>
                      <span className="text-[#9a9a9a]">|</span>
                      <ClaimPlaceButton
                        placeId={c.alreadyRegistered.id}
                        placeName={c.alreadyRegistered.name}
                      />
                    </div>
                  ) : (
                    <div className="mt-1.5 flex flex-wrap gap-3 text-xs text-[#8a8a8a]">
                      {c.detectedCategorySlug ? (
                        <span>
                          🏷️ <strong className="text-[#1a1a1a]">{categories.find(x => x.slug === c.detectedCategorySlug)?.name ?? c.detectedCategorySlug}</strong>
                          <span className="opacity-60"> {(c.detectedCategoryConfidence * 100).toFixed(0)}%</span>
                        </span>
                      ) : (
                        <span className="text-[#c2410c]">⚠️ 업종 수동 확인</span>
                      )}
                      {c.detectedCitySlug ? (
                        <span>📍 <strong className="text-[#1a1a1a]">{cities.find(x => x.slug === c.detectedCitySlug)?.name ?? c.detectedCitySlug}</strong></span>
                      ) : (
                        <span className="text-[#c2410c]">⚠️ 도시 수동 확인</span>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {naverResults.length === 0 && query.length > 0 && !loading && !selectedPlace && (
          <div className="p-4 rounded-lg border border-dashed border-[#c1c1c1] bg-[#fafafa]">
            <p className="text-sm text-[#666]">
              네이버 플레이스에 등록되지 않은 업체는 현재 <strong>직접 등록 불가</strong>합니다.
            </p>
            <p className="mt-2 text-xs text-[#8a8a8a]">
              먼저 <a href="https://smartplace.naver.com" target="_blank" rel="noopener noreferrer" className="underline">네이버 스마트플레이스</a> 또는
              <a href="https://www.google.com/business" target="_blank" rel="noopener noreferrer" className="underline ml-1">Google Business Profile</a>에 업체를 등록하신 후 다시 검색해 주세요.
            </p>
          </div>
        )}
      </div>

      {/* 선택 후 도시·업종 자동 채움 */}
      {selectedPlace && (
        <div className="mb-6 p-4 rounded-lg bg-[#f9fafb] border border-[#e5e7eb]">
          <p className="text-xs font-medium text-[#6b7280] mb-2">📋 자동 분류 결과 (필요시 수정)</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[#6a6a6a] mb-1">도시</label>
              <select value={city} onChange={e => setCity(e.target.value)} className="w-full h-10 px-3 rounded border border-[#dddddd] text-sm">
                {cities.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#6a6a6a] mb-1">업종</label>
              <input
                type="text"
                value={catSearch}
                onChange={e => { setCatSearch(e.target.value); setCategory('') }}
                placeholder={category ? (categories.find(c => c.slug === category)?.name ?? '') : '검색하여 변경'}
                className="w-full h-10 px-3 rounded border border-[#dddddd] text-sm"
              />
              {filteredCategories.length > 0 && catSearch && !category && (
                <div className="mt-1 max-h-32 overflow-y-auto rounded border border-[#dddddd] bg-white">
                  {filteredCategories.slice(0, 10).map(c => (
                    <button
                      key={c.slug}
                      type="button"
                      onClick={() => { setCategory(c.slug); setCatSearch(c.name); setSelectedSector(c.sector) }}
                      className="w-full text-left px-3 py-1.5 text-sm hover:bg-[#f2f2f2]"
                    >
                      {c.name} <span className="text-[#c1c1c1]">({c.slug})</span>
                    </button>
                  ))}
                </div>
              )}
              {category && (
                <p className="mt-1 text-xs text-[#008060]">{categories.find(c => c.slug === category)?.name}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 선택된 업체 — 폼 */}
      {selectedPlace && (
        <div className="space-y-6 border-t border-[#dddddd] pt-8">
          <div className="flex items-center justify-between">
            <p className="text-sm text-[#6a6a6a]">
              선택: <span className="font-medium text-[#222222]">{selectedPlace.name}</span> — {selectedPlace.address}
              {selectedPlace.rating != null && ` · ★ ${selectedPlace.rating}`}
            </p>
            <button onClick={() => { setSelectedPlace(null); setQuery('') }} className="text-xs text-red-500">변경</button>
          </div>

          <button
            onClick={handleAiGenerate}
            disabled={aiLoading}
            className="w-full h-12 rounded-lg bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {aiLoading ? 'AI 생성 중...' : '✨ 소개·서비스·FAQ·태그 AI 자동 생성'}
          </button>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#484848] mb-1">
                영문 이름 <span className="text-xs text-[#6a6a6a]">(자동)</span>
              </label>
              <input type="text" value={nameEn} onChange={e => setNameEn(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-[#dddddd] text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#484848] mb-1">
                URL 슬러그 <span className="text-xs text-[#6a6a6a]">(자동)</span>
              </label>
              <input type="text" value={slug} onChange={e => setSlug(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-[#dddddd] text-sm" />
              <p className="mt-1 text-xs text-[#6a6a6a]">aiplace.kr/{city}/{category}/{slug || '...'}</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#484848] mb-1">
              소개 (40~60자 권장)
              <span className={`ml-2 text-xs ${description.length >= 40 && description.length <= 60 ? 'text-green-600' : 'text-[#6a6a6a]'}`}>
                {description.length}/60자
              </span>
            </label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} maxLength={100} rows={2} className="w-full px-4 py-3 rounded-lg border border-[#dddddd] text-sm" />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#484848] mb-2">
              영업시간 <span className="text-xs text-green-600">(Google 자동)</span>
            </label>
            <div className="space-y-1">
              {hours.map((h, i) => (
                <div key={h.day} className="flex items-center gap-2">
                  <span className="w-6 text-sm font-medium text-[#484848]">{h.label}</span>
                  <label className="flex items-center gap-1">
                    <input type="checkbox" checked={h.closed} onChange={e => { const next = [...hours]; next[i] = { ...next[i], closed: e.target.checked }; setHours(next) }} className="rounded" />
                    <span className="text-xs text-[#6a6a6a]">휴무</span>
                  </label>
                  {!h.closed && (
                    <>
                      <TimeSelect value={h.open} onChange={val => {
                        setHours(prev => prev.map((item, j) => {
                          if (j === i) return { ...item, open: val }
                          if (!item.closed && !item.open) return { ...item, open: val }
                          return item
                        }))
                      }} />
                      <span className="text-xs text-[#6a6a6a]">~</span>
                      <TimeSelect value={h.close} onChange={val => {
                        setHours(prev => prev.map((item, j) => {
                          if (j === i) return { ...item, close: val }
                          if (!item.closed && !item.close) return { ...item, close: val }
                          return item
                        }))
                      }} />
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#484848] mb-1">전화번호 <span className="text-xs text-[#6a6a6a]">(자동)</span></label>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-[#dddddd] text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#484848] mb-1">카카오맵 URL</label>
              <input type="url" value={kakaoMapUrl} onChange={e => setKakaoMapUrl(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-[#dddddd] text-sm" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#484848] mb-1">네이버 플레이스 URL</label>
            <input type="url" value={naverPlaceUrl} onChange={e => setNaverPlaceUrl(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-[#dddddd] text-sm" />
          </div>

          <div>
            <h2 className="text-base font-semibold text-[#222222] mb-2">서비스</h2>
            {services.map((s, i) => (
              <div key={i} className="grid grid-cols-3 gap-2 mb-2">
                <input placeholder="서비스명" value={s.name} onChange={e => { const next = [...services]; next[i] = { ...next[i], name: e.target.value }; setServices(next) }} className="h-10 px-3 rounded-lg border border-[#dddddd] text-sm" />
                <input placeholder="설명" value={s.description} onChange={e => { const next = [...services]; next[i] = { ...next[i], description: e.target.value }; setServices(next) }} className="h-10 px-3 rounded-lg border border-[#dddddd] text-sm" />
                <input placeholder="가격대" value={s.priceRange} onChange={e => { const next = [...services]; next[i] = { ...next[i], priceRange: e.target.value }; setServices(next) }} className="h-10 px-3 rounded-lg border border-[#dddddd] text-sm" />
              </div>
            ))}
            <button onClick={() => setServices([...services, { name: '', description: '', priceRange: '' }])} className="text-sm text-[#008060]">+ 서비스 추가</button>
          </div>

          <div>
            <h2 className="text-base font-semibold text-[#222222] mb-2">FAQ</h2>
            {faqs.map((f, i) => (
              <div key={i} className="space-y-1 mb-3">
                <input placeholder="질문 (업체명 + ?로 끝나게)" value={f.question} onChange={e => { const next = [...faqs]; next[i] = { ...next[i], question: e.target.value }; setFaqs(next) }} className="w-full h-10 px-3 rounded-lg border border-[#dddddd] text-sm" />
                <input placeholder="답변" value={f.answer} onChange={e => { const next = [...faqs]; next[i] = { ...next[i], answer: e.target.value }; setFaqs(next) }} className="w-full h-10 px-3 rounded-lg border border-[#dddddd] text-sm" />
              </div>
            ))}
            <button onClick={() => setFaqs([...faqs, { question: '', answer: '' }])} className="text-sm text-[#008060]">+ FAQ 추가</button>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#484848] mb-1">태그 (쉼표로 구분)</label>
            <input type="text" value={tags} onChange={e => setTags(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-[#dddddd] text-sm" placeholder="여드름, 레이저, 보톡스" />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#484848] mb-2">
              사진 <span className="text-xs text-green-600">(Google Places 자동)</span>
            </label>
            {photoRefs.length === 0 ? (
              <p className="text-xs text-[#9a9a9a] p-3 rounded-lg bg-[#fafafa] border border-dashed border-[#dddddd]">
                Google Places 에 등록된 사진이 없거나 매칭 실패했습니다. 업체 등록 후 Google Business Profile 에 사진을 추가하면 자동으로 반영됩니다.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {photoRefs.map((ref) => {
                    const checked = selectedPhotos.has(ref)
                    return (
                      <label
                        key={ref}
                        className={`relative block aspect-square overflow-hidden rounded-lg border-2 cursor-pointer transition-all ${checked ? 'border-[#008060]' : 'border-[#dddddd] opacity-60'}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={e => {
                            setSelectedPhotos(prev => {
                              const next = new Set(prev)
                              if (e.target.checked) next.add(ref)
                              else next.delete(ref)
                              return next
                            })
                          }}
                          className="absolute top-1.5 left-1.5 z-10"
                        />
                        { /* eslint-disable-next-line @next/next/no-img-element */ }
                        <img
                          src={`/api/places/photo?ref=${encodeURIComponent(ref)}&w=400`}
                          alt=""
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </label>
                    )
                  })}
                </div>
                <p className="mt-2 text-xs text-[#9a9a9a]">
                  {selectedPhotos.size} / {photoRefs.length} 장 선택됨. 체크 해제하면 페이지에 노출되지 않습니다.
                </p>
              </>
            )}
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full h-12 rounded-lg bg-[#008060] text-white font-medium disabled:opacity-50 hover:bg-[#006e52] transition-colors"
          >
            {loading ? '등록 중...' : '업체 등록'}
          </button>
        </div>
      )}
    </div>
  )
}
