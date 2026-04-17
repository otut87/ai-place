'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { searchPlaceUnified, enrichPlace, registerPlace, generatePlaceContent, getAdminOptions } from '@/lib/actions/register-place'
import type { PlaceSearchResult } from '@/lib/google-places'
import { AddressPicker, type AddressResult } from '@/components/admin/address-picker'

type UnifiedCandidate = {
  kakaoPlaceId?: string
  googlePlaceId?: string
  naverLink?: string
  displayName: string
  roadAddress?: string | null
  jibunAddress?: string | null
  latitude: number
  longitude: number
  phone?: string | null
  rating?: number
  reviewCount?: number
  sources: string[]
  sameAs: string[]
  kakaoCategory?: string
  naverCategory?: string
  detectedCategorySlug: string | null
  detectedCategoryTier: number | null
  detectedCategoryConfidence: number
  detectedCitySlug: string | null
}

// 30분 단위 시간 드롭다운
const TIME_OPTIONS = Array.from({ length: 33 }, (_, i) => {
  const h = Math.floor(i / 2) + 7 // 07:00 ~ 23:00
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

export default function RegisterPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 카테고리/도시 옵션
  const [cities, setCities] = useState<Array<{ slug: string; name: string }>>([{ slug: 'cheonan', name: '천안' }])
  const [allCategories, setAllCategories] = useState<Array<{ slug: string; name: string; sector: string }>>([])
  const [selectedSector, setSelectedSector] = useState('')
  const [catSearch, setCatSearch] = useState('')

  useEffect(() => {
    getAdminOptions().then(opts => {
      setCities(opts.cities)
      setAllCategories(opts.categories)
    })
  }, [])

  const filteredCategories = allCategories.filter(c => {
    const matchesSector = selectedSector ? c.sector === selectedSector : true
    const matchesSearch = catSearch
      ? c.name.includes(catSearch) || c.slug.includes(catSearch.toLowerCase())
      : true
    return matchesSector && matchesSearch
  })

  // 검색
  const [city, setCity] = useState('cheonan')
  const [category, setCategory] = useState('')
  const [query, setQuery] = useState('')
  // T-018: 3-Source 통합 검색 (기본이자 유일한 경로)
  const [unifiedResults, setUnifiedResults] = useState<UnifiedCandidate[]>([])
  const [manualAddress, setManualAddress] = useState<AddressResult | null>(null)

  // 업체 정보 (검색 선택 후 자동 채우기)
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
  const [faqs, setFaqs] = useState([{ question: '', answer: '' }, { question: '', answer: '' }, { question: '', answer: '' }])
  const [tags, setTags] = useState('')

  async function handleSearch() {
    if (!query.trim()) return
    setLoading(true)
    setError(null)
    setUnifiedResults([])

    const result = await searchPlaceUnified(query)
    setLoading(false)
    if (result.success) setUnifiedResults(result.data)
    else setError(result.error)
  }

  /** 3-Source 통합 결과에서 선택 → 폼 자동 채우기 */
  function handleSelectUnified(c: UnifiedCandidate) {
    // city / category 자동 채우기 (detectCitySlug 가 지원 목록에 있으면)
    if (c.detectedCitySlug && cities.some(x => x.slug === c.detectedCitySlug)) {
      setCity(c.detectedCitySlug)
    }
    if (c.detectedCategorySlug && allCategories.some(x => x.slug === c.detectedCategorySlug)) {
      setCategory(c.detectedCategorySlug)
      const cat = allCategories.find(x => x.slug === c.detectedCategorySlug)
      if (cat) setSelectedSector(cat.sector)
    }
    // PlaceSearchResult 호환 객체 로 selectedPlace 세팅 (기존 플로우 재사용)
    const asGoogle: PlaceSearchResult = {
      placeId: c.googlePlaceId ?? c.kakaoPlaceId ?? 'unified',
      name: c.displayName,
      address: c.roadAddress ?? c.jibunAddress ?? '',
      rating: c.rating,
      reviewCount: c.reviewCount,
      latitude: c.latitude,
      longitude: c.longitude,
    }
    setSelectedPlace(asGoogle)
    setUnifiedResults([])
    // Google 보강은 place_id 있을 때만
    if (c.googlePlaceId) {
      handleSelectPlace(asGoogle)
    } else {
      // Kakao/Naver-only: 기본 정보만 채움
      if (c.phone) setPhone(c.phone)
      const slugCandidate = c.displayName.replace(/\s+/g, '-').toLowerCase().replace(/[^a-z0-9-가-힣]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '')
      setSlug(slugCandidate.slice(0, 100) || `${c.detectedCategorySlug ?? 'place'}-${Date.now().toString(36).slice(-4)}`)
    }
  }

  /** 수동 등록: Daum Postcode 로 주소만 받고 폼 열기 */
  function handleManualEntry(addr: AddressResult) {
    setSelectedPlace({
      placeId: 'manual',
      name: query || '',
      address: addr.roadAddress,
    })
    setUnifiedResults([])
    // 도로명 주소 세팅 (추후 handleSubmit 에서 roadAddress/zonecode/sigunguCode 로 전달)
    setManualAddress(addr)
  }

  async function handleSelectPlace(place: PlaceSearchResult) {
    setSelectedPlace(place)
    setLoading(true)

    // Google + 카카오 자동 보강
    const enriched = await enrichPlace(place.placeId, place.name)
    if (enriched.success) {
      const d = enriched.data
      if (d.nameEn) setNameEn(d.nameEn)
      // 슬러그: 영문 이름에서 생성, 영문 없으면 카테고리+랜덤
      const nameForSlug = d.nameEn ?? place.name
      const slugCandidate = nameForSlug.replace(/\s+/g, '-').toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '')
      setSlug(slugCandidate || `${category}-${Date.now().toString(36).slice(-4)}`)
      if (d.phone) setPhone(d.phone)
      // Google 영업시간 파싱 → 구조화 입력
      if (d.openingHours) {
        const dayMap: Record<string, string> = { '월요일': 'Mo', '화요일': 'Tu', '수요일': 'We', '목요일': 'Th', '금요일': 'Fr', '토요일': 'Sa', '일요일': 'Su' }
        setHours(prev => prev.map(h => {
          const line = d.openingHours?.find(l => {
            const dayKr = Object.entries(dayMap).find(([, v]) => v === h.day)?.[0]
            return dayKr && l.startsWith(dayKr)
          })
          if (!line) return { ...h, closed: true, open: '', close: '' }
          if (line.includes('휴무')) return { ...h, closed: true, open: '', close: '' }
          // "월요일: 오전 10:00 ~ 오후 8:00" → open/close 추출
          const timeMatch = line.match(/(\d{1,2}:\d{2})\s*~\s*.*?(\d{1,2}:\d{2})/)
          if (!timeMatch) return h
          const openH = line.includes('오후') && !line.includes('오전') ? parseInt(timeMatch[1]) + 12 : parseInt(timeMatch[1])
          // 간단한 24시간 변환
          const rawOpen = timeMatch[1]
          const rawClose = timeMatch[2]
          const openTime = line.indexOf('오후') < line.indexOf(rawOpen) && parseInt(rawOpen) < 12 ? `${parseInt(rawOpen) + 12}:${rawOpen.split(':')[1]}` : rawOpen.padStart(5, '0')
          const closeIdx = line.lastIndexOf('오후')
          const closeTime = closeIdx > line.indexOf(rawOpen) && parseInt(rawClose) < 12 ? `${parseInt(rawClose) + 12}:${rawClose.split(':')[1]}` : rawClose.padStart(5, '0')
          return { ...h, closed: false, open: openTime, close: closeTime }
        }))
      }
      if (d.kakaoMapUrl) setKakaoMapUrl(d.kakaoMapUrl)
      if (d.reviews) setEnrichedReviews(d.reviews)
      setEnrichedData({ openingHours: d.openingHours, editorialSummary: d.editorialSummary })
    }
    setLoading(false)
  }

  async function handleAiGenerate() {
    if (!selectedPlace) return
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
    setLoading(true)
    setError(null)
    // placeId 가 'manual' 이거나 'unified' 이면 Google ID 없음
    const isManual = selectedPlace.placeId === 'manual'
    const isUnified = selectedPlace.placeId === 'unified'
    const result = await registerPlace({
      city, category,
      googlePlaceId: (isManual || isUnified) ? undefined : selectedPlace.placeId,
      manual: isManual || undefined,
      name: selectedPlace.name,
      nameEn: nameEn || undefined,
      slug, description,
      address: selectedPlace.address || manualAddress?.roadAddress || '',
      phone: phone || undefined,
      openingHours: hours.filter(h => !h.closed && h.open && h.close).map(h => `${h.day} ${h.open}-${h.close}`) || undefined,
      rating: selectedPlace.rating,
      reviewCount: selectedPlace.reviewCount,
      googleBusinessUrl: undefined,
      naverPlaceUrl: naverPlaceUrl || undefined,
      kakaoMapUrl: kakaoMapUrl || undefined,
      latitude: selectedPlace.latitude,
      longitude: selectedPlace.longitude,
      roadAddress: manualAddress?.roadAddress,
      jibunAddress: manualAddress?.jibunAddress,
      sigunguCode: manualAddress?.sigunguCode,
      zonecode: manualAddress?.zonecode,
      services: services.filter(s => s.name.trim()),
      faqs: faqs.filter(f => f.question.trim() && f.answer.trim()),
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
    })
    setLoading(false)
    if (result.success) {
      router.push('/admin/places')
    } else {
      setError(result.error)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <h1 className="text-2xl font-bold text-[#222222] mb-8">업체 등록</h1>

      {error && <p className="mb-4 text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}

      {/* 검색 영역 — T-018: 단일 입력 + 자동 분류 */}
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
            <button onClick={handleSearch} disabled={loading} className="h-12 px-6 rounded-lg bg-[#222222] text-white font-medium disabled:opacity-50">
              {loading ? '검색 중...' : '검색'}
            </button>
          </div>
          <p className="mt-2 text-xs text-[#8a8a8a]">
            Kakao + Google + Naver 3곳 통합 검색 → 자동 중복 제거 + 카테고리/도시 자동 분류 (LLM 폴백). 결과 없으면 아래 &ldquo;주소로 수동 등록&rdquo;.
          </p>
        </div>

        {/* 3-Source 통합 결과 */}
        {unifiedResults.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm text-[#6a6a6a]">{unifiedResults.length}개 후보 (중복 제거 + 자동 병합)</p>
            {unifiedResults.map((c, idx) => (
              <button
                key={`${c.kakaoPlaceId ?? c.googlePlaceId ?? c.naverLink ?? idx}`}
                onClick={() => handleSelectUnified(c)}
                className="w-full text-left p-4 rounded-lg border border-[#dddddd] hover:border-[#222222] transition-colors"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-[#222222]">{c.displayName}</p>
                  {c.sources.map(s => (
                    <span key={s} className="px-1.5 py-0.5 text-[10px] rounded bg-[#eff6ff] text-[#1e40af] font-medium">
                      {s}
                    </span>
                  ))}
                </div>
                <p className="text-sm text-[#6a6a6a] mt-1">{c.roadAddress ?? c.jibunAddress}</p>
                <div className="mt-1.5 flex flex-wrap gap-3 text-xs text-[#8a8a8a]">
                  {c.rating != null && <span>★ {c.rating} · 후기 {c.reviewCount}건</span>}
                  {c.detectedCategorySlug ? (
                    <span>
                      🏷️ <strong className="text-[#1a1a1a]">{allCategories.find(x => x.slug === c.detectedCategorySlug)?.name ?? c.detectedCategorySlug}</strong>
                      <span className="opacity-60"> Tier {c.detectedCategoryTier} · {(c.detectedCategoryConfidence * 100).toFixed(0)}%</span>
                    </span>
                  ) : (
                    <span className="text-[#c2410c]">⚠️ 카테고리 수동 확인 필요</span>
                  )}
                  {c.detectedCitySlug ? (
                    <span>📍 <strong className="text-[#1a1a1a]">{cities.find(x => x.slug === c.detectedCitySlug)?.name ?? c.detectedCitySlug}</strong></span>
                  ) : (
                    <span className="text-[#c2410c]">⚠️ 도시 수동 확인 필요</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* 수동 등록 fallback — 검색 했는데 결과 0 */}
        {unifiedResults.length === 0 && query.length > 0 && !loading && !selectedPlace && (
          <div className="p-4 rounded-lg border border-dashed border-[#c1c1c1] bg-[#fafafa] flex items-center justify-between">
            <p className="text-sm text-[#666]">
              검색 결과 없음 — 주소로 직접 등록하시겠어요?
            </p>
            <AddressPicker onSelect={handleManualEntry} triggerLabel="주소로 수동 등록" />
          </div>
        )}

        {manualAddress && (
          <div className="p-3 rounded-lg bg-[#f0f9ff] text-sm text-[#1a4b7c]">
            수동 등록: {manualAddress.roadAddress}{manualAddress.buildingName ? ` (${manualAddress.buildingName})` : ''}
            <span className="ml-2 text-xs opacity-70">우편번호 {manualAddress.zonecode} · 시군구 {manualAddress.sigunguCode}</span>
          </div>
        )}
      </div>

      {/* 선택 후 도시·카테고리 확인/수정 (자동 채움 + override 가능) */}
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
              <label className="block text-xs text-[#6a6a6a] mb-1">카테고리</label>
              <input
                type="text"
                value={catSearch}
                onChange={e => { setCatSearch(e.target.value); setCategory('') }}
                placeholder={category ? (allCategories.find(c => c.slug === category)?.name ?? '') : '검색하여 변경'}
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
                <p className="mt-1 text-xs text-[#008060]">{allCategories.find(c => c.slug === category)?.name} ({category})</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 선택된 업체 — 전체 폼 */}
      {selectedPlace && (
        <div className="space-y-6 border-t border-[#dddddd] pt-8">
          <div className="flex items-center justify-between">
            <p className="text-sm text-[#6a6a6a]">
              선택: <span className="font-medium text-[#222222]">{selectedPlace.name}</span> — {selectedPlace.address}
              {selectedPlace.rating != null && ` · ★ ${selectedPlace.rating}`}
            </p>
            <button onClick={() => { setSelectedPlace(null); setQuery('') }} className="text-xs text-red-500">변경</button>
          </div>

          {/* AI 전체 자동 생성 버튼 */}
          <button
            onClick={handleAiGenerate}
            disabled={aiLoading}
            className="w-full h-12 rounded-lg bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {aiLoading ? 'AI 생성 중...' : 'AI로 설명/서비스/FAQ/태그 전체 자동 생성'}
          </button>

          {/* 기본 정보 */}
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
              <p className="mt-1 text-xs text-[#6a6a6a]">aiplace.kr/{city}/{category}/{slug}</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#484848] mb-1">
              설명 (Direct Answer Block)
              <span className={`ml-2 text-xs ${description.length >= 40 && description.length <= 60 ? 'text-green-600' : 'text-red-600'}`}>
                {description.length}/60자 {description.length < 40 ? '(최소 40자)' : description.length > 60 ? '(60자 초과)' : '✓'}
              </span>
            </label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} maxLength={65} rows={2} className="w-full px-4 py-3 rounded-lg border border-[#dddddd] text-sm" />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#484848] mb-2">
              영업시간 <span className="text-xs text-green-600">(Google 자동 입력)</span>
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
              <p className="text-xs text-[#6a6a6a] mt-1">첫 요일 선택 시 빈 칸에 자동 복사</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#484848] mb-1">전화번호 <span className="text-xs text-[#6a6a6a]">(자동)</span></label>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-[#dddddd] text-sm" placeholder="+82-41-XXX-XXXX" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#484848] mb-1">
                카카오맵 URL <span className="text-xs text-green-600">(자동)</span>
              </label>
              <input type="url" value={kakaoMapUrl} onChange={e => setKakaoMapUrl(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-[#dddddd] text-sm" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#484848] mb-1">
              네이버 플레이스 URL <span className="text-xs text-[#6a6a6a]">(검색 후 복사)</span>
            </label>
            <div className="flex gap-2">
              <input type="url" value={naverPlaceUrl} onChange={e => setNaverPlaceUrl(e.target.value)} className="flex-1 h-10 px-3 rounded-lg border border-[#dddddd] text-sm" placeholder="https://naver.me/..." />
              <a
                href={`https://map.naver.com/search/${encodeURIComponent(selectedPlace.name)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="h-10 px-3 inline-flex items-center rounded-lg border border-[#dddddd] text-xs text-[#484848] hover:border-[#222222] whitespace-nowrap"
              >
                네이버 검색
              </a>
            </div>
          </div>

          {/* 서비스 */}
          <div>
            <h2 className="text-base font-semibold text-[#222222] mb-2">서비스 (최소 1개)</h2>
            {services.map((s, i) => (
              <div key={i} className="grid grid-cols-3 gap-2 mb-2">
                <input placeholder="서비스명" value={s.name} onChange={e => { const next = [...services]; next[i] = { ...next[i], name: e.target.value }; setServices(next) }} className="h-10 px-3 rounded-lg border border-[#dddddd] text-sm" />
                <input placeholder="설명" value={s.description} onChange={e => { const next = [...services]; next[i] = { ...next[i], description: e.target.value }; setServices(next) }} className="h-10 px-3 rounded-lg border border-[#dddddd] text-sm" />
                <input placeholder="가격대" value={s.priceRange} onChange={e => { const next = [...services]; next[i] = { ...next[i], priceRange: e.target.value }; setServices(next) }} className="h-10 px-3 rounded-lg border border-[#dddddd] text-sm" />
              </div>
            ))}
            <button onClick={() => setServices([...services, { name: '', description: '', priceRange: '' }])} className="text-sm text-[#00a67c]">+ 서비스 추가</button>
          </div>

          {/* FAQ */}
          <div>
            <h2 className="text-base font-semibold text-[#222222] mb-2">FAQ (최소 3개)</h2>
            {faqs.map((f, i) => (
              <div key={i} className="space-y-1 mb-3">
                <input placeholder="질문 (물음표로 끝나야 함)" value={f.question} onChange={e => { const next = [...faqs]; next[i] = { ...next[i], question: e.target.value }; setFaqs(next) }} className="w-full h-10 px-3 rounded-lg border border-[#dddddd] text-sm" />
                <input placeholder="답변" value={f.answer} onChange={e => { const next = [...faqs]; next[i] = { ...next[i], answer: e.target.value }; setFaqs(next) }} className="w-full h-10 px-3 rounded-lg border border-[#dddddd] text-sm" />
              </div>
            ))}
            <button onClick={() => setFaqs([...faqs, { question: '', answer: '' }])} className="text-sm text-[#00a67c]">+ FAQ 추가</button>
          </div>

          {/* 태그 */}
          <div>
            <label className="block text-sm font-medium text-[#484848] mb-1">태그 (쉼표로 구분)</label>
            <input type="text" value={tags} onChange={e => setTags(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-[#dddddd] text-sm" placeholder="여드름, 레이저, 보톡스" />
          </div>

          {/* 등록 버튼 */}
          <button onClick={handleSubmit} disabled={loading} className="w-full h-12 rounded-lg bg-[#222222] text-white font-medium disabled:opacity-50">
            {loading ? '등록 중...' : '업체 등록'}
          </button>
        </div>
      )}
    </div>
  )
}
