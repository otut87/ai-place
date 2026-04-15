'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { searchPlace, enrichPlace, registerPlace } from '@/lib/actions/register-place'
import type { PlaceSearchResult } from '@/lib/google-places'

type Step = 'search' | 'details' | 'content' | 'confirm'

const CATEGORY_NAME_KR: Record<string, string> = {
  dermatology: '피부과', interior: '인테리어', webagency: '웹에이전시',
  'auto-repair': '자동차정비', hairsalon: '미용실',
}

export default function RegisterPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('search')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Step 1: 검색
  const [city, setCity] = useState('cheonan')
  const [category, setCategory] = useState('dermatology')
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<PlaceSearchResult[]>([])

  // Step 2: 선택된 업체 정보
  const [selectedPlace, setSelectedPlace] = useState<PlaceSearchResult | null>(null)
  const [nameEn, setNameEn] = useState('')
  const [slug, setSlug] = useState('')
  const [description, setDescription] = useState('')
  const [phone, setPhone] = useState('')
  const [naverPlaceUrl, setNaverPlaceUrl] = useState('')
  const [kakaoMapUrl, setKakaoMapUrl] = useState('')

  // Step 3: 서비스/FAQ
  const [services, setServices] = useState([{ name: '', description: '', priceRange: '' }])
  const [faqs, setFaqs] = useState([{ question: '', answer: '' }, { question: '', answer: '' }, { question: '', answer: '' }])
  const [tags, setTags] = useState('')

  async function handleSearch() {
    if (!query.trim()) return
    setLoading(true)
    setError(null)
    const result = await searchPlace(query, city === 'cheonan' ? '천안' : city)
    setLoading(false)
    if (result.success) {
      setSearchResults(result.data)
    } else {
      setError(result.error)
    }
  }

  async function handleSelectPlace(place: PlaceSearchResult) {
    setSelectedPlace(place)
    setLoading(true)
    const enriched = await enrichPlace(place.placeId, place.name)
    setLoading(false)

    if (enriched.success) {
      const d = enriched.data
      // 영문 이름 → 슬러그 자동 생성
      if (d.nameEn) {
        setNameEn(d.nameEn)
        setSlug(d.nameEn.replace(/\s+/g, '-').toLowerCase().replace(/[^a-z0-9-]/g, ''))
      } else {
        setSlug(place.name.replace(/\s+/g, '-').toLowerCase().replace(/[^a-z0-9-]/g, '') || 'new-place')
      }
      // 전화번호 자동 채우기
      if (d.phone) setPhone(d.phone)
      // 네이버/카카오 URL 자동 채우기
      if (d.naverPlaceUrl) setNaverPlaceUrl(d.naverPlaceUrl)
      if (d.kakaoMapUrl) setKakaoMapUrl(d.kakaoMapUrl)
      // 설명 자동 생성 (템플릿)
      const area = place.address.split(' ').slice(1, 3).join(' ')
      const catName = CATEGORY_NAME_KR[category] ?? category
      setDescription(`${area} 위치. ${catName} 전문. 상세 설명은 직접 수정해주세요.`)
    }
    setStep('details')
  }

  async function handleSubmit() {
    if (!selectedPlace) return
    setLoading(true)
    setError(null)

    const result = await registerPlace({
      city,
      category,
      googlePlaceId: selectedPlace.placeId,
      name: selectedPlace.name,
      nameEn: nameEn || undefined,
      slug,
      description,
      address: selectedPlace.address,
      phone: phone || undefined,
      openingHours: undefined,
      rating: selectedPlace.rating,
      reviewCount: selectedPlace.reviewCount,
      googleBusinessUrl: undefined,
      naverPlaceUrl: naverPlaceUrl || undefined,
      kakaoMapUrl: kakaoMapUrl || undefined,
      latitude: selectedPlace.latitude,
      longitude: selectedPlace.longitude,
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

      {/* Step 1: 검색 */}
      {step === 'search' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#484848] mb-1">도시</label>
              <select value={city} onChange={e => setCity(e.target.value)} className="w-full h-12 px-4 rounded-lg border border-[#dddddd]">
                <option value="cheonan">천안</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#484848] mb-1">카테고리</label>
              <select value={category} onChange={e => setCategory(e.target.value)} className="w-full h-12 px-4 rounded-lg border border-[#dddddd]">
                <option value="dermatology">피부과</option>
                <option value="interior">인테리어</option>
                <option value="webagency">웹에이전시</option>
                <option value="auto-repair">자동차정비</option>
                <option value="hairsalon">미용실</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#484848] mb-1">업체명 검색</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="예: 수피부과의원"
                className="flex-1 h-12 px-4 rounded-lg border border-[#dddddd]"
              />
              <button
                onClick={handleSearch}
                disabled={loading}
                className="h-12 px-6 rounded-lg bg-[#222222] text-white font-medium disabled:opacity-50"
              >
                {loading ? '검색 중...' : '검색'}
              </button>
            </div>
          </div>

          {searchResults.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-[#6a6a6a]">{searchResults.length}개 결과</p>
              {searchResults.map(place => (
                <button
                  key={place.placeId}
                  onClick={() => handleSelectPlace(place)}
                  className="w-full text-left p-4 rounded-lg border border-[#dddddd] hover:border-[#222222] transition-colors"
                >
                  <p className="font-medium text-[#222222]">{place.name}</p>
                  <p className="text-sm text-[#6a6a6a]">{place.address}</p>
                  {place.rating && <p className="text-sm text-[#6a6a6a]">★ {place.rating} · 후기 {place.reviewCount}건</p>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step 2: 기본 정보 */}
      {step === 'details' && selectedPlace && (
        <div className="space-y-4">
          <p className="text-sm text-[#6a6a6a]">선택: {selectedPlace.name} — {selectedPlace.address}</p>

          <div>
            <label className="block text-sm font-medium text-[#484848] mb-1">
              영문 이름 <span className="text-xs text-[#6a6a6a]">(Google에서 자동 입력)</span>
            </label>
            <input type="text" value={nameEn} onChange={e => setNameEn(e.target.value)} className="w-full h-12 px-4 rounded-lg border border-[#dddddd]" />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#484848] mb-1">
              URL 슬러그 <span className="text-xs text-[#6a6a6a]">(영문 이름에서 자동 생성)</span>
            </label>
            <input type="text" value={slug} onChange={e => setSlug(e.target.value)} className="w-full h-12 px-4 rounded-lg border border-[#dddddd]" />
            <p className="mt-1 text-xs text-[#6a6a6a]">aiplace.kr/{city}/{category}/{slug}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#484848] mb-1">
              설명 (Direct Answer Block)
              <span className={`ml-2 text-xs ${description.length >= 40 && description.length <= 60 ? 'text-green-600' : 'text-red-600'}`}>
                {description.length}/60자 {description.length < 40 ? '(최소 40자)' : description.length > 60 ? '(60자 초과)' : '✓'}
              </span>
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              maxLength={65}
              rows={2}
              className="w-full px-4 py-3 rounded-lg border border-[#dddddd]"
              placeholder="천안시 서북구 위치. 피부과 전문의가 진료하는 피부과 전문 의원입니다."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#484848] mb-1">전화번호</label>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="w-full h-12 px-4 rounded-lg border border-[#dddddd]" placeholder="+82-41-XXX-XXXX" />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#484848] mb-1">네이버 플레이스 URL</label>
            <div className="flex gap-2">
              <input type="url" value={naverPlaceUrl} onChange={e => setNaverPlaceUrl(e.target.value)} className="flex-1 h-12 px-4 rounded-lg border border-[#dddddd]" placeholder="https://naver.me/..." />
              <a
                href={`https://map.naver.com/search/${encodeURIComponent(selectedPlace?.name ?? '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="h-12 px-4 inline-flex items-center rounded-lg border border-[#dddddd] text-sm text-[#484848] hover:border-[#222222] whitespace-nowrap"
              >
                네이버에서 검색
              </a>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#484848] mb-1">카카오맵 URL</label>
            <div className="flex gap-2">
              <input type="url" value={kakaoMapUrl} onChange={e => setKakaoMapUrl(e.target.value)} className="flex-1 h-12 px-4 rounded-lg border border-[#dddddd]" placeholder="https://place.map.kakao.com/..." />
              <a
                href={`https://map.kakao.com/?q=${encodeURIComponent(selectedPlace?.name ?? '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="h-12 px-4 inline-flex items-center rounded-lg border border-[#dddddd] text-sm text-[#484848] hover:border-[#222222] whitespace-nowrap"
              >
                카카오에서 검색
              </a>
            </div>
          </div>

          <button onClick={() => setStep('content')} className="h-12 px-6 rounded-lg bg-[#222222] text-white font-medium">
            다음: 서비스/FAQ 입력
          </button>
        </div>
      )}

      {/* Step 3: 서비스 + FAQ */}
      {step === 'content' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-[#222222] mb-3">서비스 (최소 1개)</h2>
            {services.map((s, i) => (
              <div key={i} className="grid grid-cols-3 gap-2 mb-2">
                <input placeholder="서비스명" value={s.name} onChange={e => { const next = [...services]; next[i] = { ...next[i], name: e.target.value }; setServices(next) }} className="h-10 px-3 rounded-lg border border-[#dddddd] text-sm" />
                <input placeholder="설명" value={s.description} onChange={e => { const next = [...services]; next[i] = { ...next[i], description: e.target.value }; setServices(next) }} className="h-10 px-3 rounded-lg border border-[#dddddd] text-sm" />
                <input placeholder="가격대" value={s.priceRange} onChange={e => { const next = [...services]; next[i] = { ...next[i], priceRange: e.target.value }; setServices(next) }} className="h-10 px-3 rounded-lg border border-[#dddddd] text-sm" />
              </div>
            ))}
            <button onClick={() => setServices([...services, { name: '', description: '', priceRange: '' }])} className="text-sm text-[#00a67c]">+ 서비스 추가</button>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-[#222222] mb-3">FAQ (최소 3개, 물음표로 끝나야 함)</h2>
            {faqs.map((f, i) => (
              <div key={i} className="space-y-1 mb-3">
                <input placeholder="질문 (예: 예약은 어떻게 하나요?)" value={f.question} onChange={e => { const next = [...faqs]; next[i] = { ...next[i], question: e.target.value }; setFaqs(next) }} className="w-full h-10 px-3 rounded-lg border border-[#dddddd] text-sm" />
                <input placeholder="답변" value={f.answer} onChange={e => { const next = [...faqs]; next[i] = { ...next[i], answer: e.target.value }; setFaqs(next) }} className="w-full h-10 px-3 rounded-lg border border-[#dddddd] text-sm" />
              </div>
            ))}
            <button onClick={() => setFaqs([...faqs, { question: '', answer: '' }])} className="text-sm text-[#00a67c]">+ FAQ 추가</button>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#484848] mb-1">태그 (쉼표로 구분)</label>
            <input type="text" value={tags} onChange={e => setTags(e.target.value)} className="w-full h-12 px-4 rounded-lg border border-[#dddddd]" placeholder="여드름, 레이저, 보톡스" />
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep('details')} className="h-12 px-6 rounded-lg border border-[#dddddd] text-[#484848]">이전</button>
            <button onClick={handleSubmit} disabled={loading} className="h-12 px-6 rounded-lg bg-[#222222] text-white font-medium disabled:opacity-50">
              {loading ? '등록 중...' : '업체 등록'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
