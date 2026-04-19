'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { getPlaceById, updatePlace } from '@/lib/actions/manage-place'
import { serializePostgrestError, formatUserFacingError } from '@/lib/supabase/error'

export default function EditPlacePage() {
  const router = useRouter()
  const params = useParams()
  const placeId = params.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [phone, setPhone] = useState('')
  const [naverPlaceUrl, setNaverPlaceUrl] = useState('')
  const [kakaoMapUrl, setKakaoMapUrl] = useState('')
  const [homepageUrl, setHomepageUrl] = useState('')
  const [blogUrl, setBlogUrl] = useState('')
  const [instagramUrl, setInstagramUrl] = useState('')
  const [naverReviewCount, setNaverReviewCount] = useState('')
  const [kakaoRating, setKakaoRating] = useState('')
  const [kakaoReviewCount, setKakaoReviewCount] = useState('')
  const [services, setServices] = useState<Array<{ name: string; description?: string; priceRange?: string }>>([])
  const [faqs, setFaqs] = useState<Array<{ question: string; answer: string }>>([])
  const [tags, setTags] = useState('')

  useEffect(() => {
    getPlaceById(placeId).then(data => {
      if (!data) { setError('업체를 찾을 수 없습니다.'); setLoading(false); return }
      const d = data as Record<string, unknown>
      setName((d.name as string) ?? '')
      setDescription((d.description as string) ?? '')
      setPhone((d.phone as string) ?? '')
      setNaverPlaceUrl((d.naver_place_url as string) ?? '')
      setKakaoMapUrl((d.kakao_map_url as string) ?? '')
      setHomepageUrl((d.homepage_url as string) ?? '')
      setBlogUrl((d.blog_url as string) ?? '')
      setInstagramUrl((d.instagram_url as string) ?? '')
      setNaverReviewCount(d.naver_review_count != null ? String(d.naver_review_count) : '')
      setKakaoRating(d.kakao_rating != null ? String(d.kakao_rating) : '')
      setKakaoReviewCount(d.kakao_review_count != null ? String(d.kakao_review_count) : '')
      setServices((d.services as Array<{ name: string; description?: string; priceRange?: string }>) ?? [])
      setFaqs((d.faqs as Array<{ question: string; answer: string }>) ?? [])
      setTags(((d.tags as string[]) ?? []).join(', '))
      setLoading(false)
    }).catch(err => {
      const serialized = serializePostgrestError(err)
      console.error('[edit] getPlaceById error:', serialized)
      setError(`데이터 로딩 실패: ${formatUserFacingError(err)}`)
      setLoading(false)
    })
  }, [placeId])

  async function handleSave() {
    setSaving(true)
    setError(null)
    const parseIntSafe = (v: string): number | null => {
      const t = v.trim()
      if (!t) return null
      const n = Number.parseInt(t, 10)
      return Number.isFinite(n) && n >= 0 ? n : null
    }
    const parseRatingSafe = (v: string): number | null => {
      const t = v.trim()
      if (!t) return null
      const n = Number.parseFloat(t)
      return Number.isFinite(n) && n >= 0 && n <= 5 ? n : null
    }

    const result = await updatePlace(placeId, {
      name,
      description,
      phone: phone || undefined,
      naver_place_url: naverPlaceUrl || undefined,
      kakao_map_url: kakaoMapUrl || undefined,
      homepage_url: homepageUrl || undefined,
      blog_url: blogUrl || undefined,
      instagram_url: instagramUrl || undefined,
      naver_review_count: parseIntSafe(naverReviewCount),
      kakao_rating: parseRatingSafe(kakaoRating),
      kakao_review_count: parseIntSafe(kakaoReviewCount),
      services: services.filter(s => s.name.trim()),
      faqs: faqs.filter(f => f.question.trim() && f.answer.trim()),
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
    })
    setSaving(false)
    if (result.success) {
      router.push('/admin/places')
    } else {
      setError(result.error ?? '수정 실패')
    }
  }

  if (loading) return <div className="max-w-2xl mx-auto px-6 py-12">로딩 중...</div>

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <h1 className="text-2xl font-bold text-[#222222] mb-8">업체 수정: {name}</h1>

      {error && <p className="mb-4 text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-[#484848] mb-1">업체명</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-[#dddddd] text-sm" />
        </div>

        <div>
          <label className="block text-sm font-medium text-[#484848] mb-1">
            설명
            <span className={`ml-2 text-xs ${description.length >= 40 && description.length <= 60 ? 'text-green-600' : 'text-red-600'}`}>
              {description.length}/60자
            </span>
          </label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} maxLength={65} rows={2} className="w-full px-3 py-2 rounded-lg border border-[#dddddd] text-sm" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-[#484848] mb-1">전화번호</label>
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

        {/* Phase 11 — 외부 링크 3종 + 소스별 수치 (수동 입력) */}
        <fieldset className="border border-[#e5e5e5] rounded-lg p-4">
          <legend className="px-2 text-xs font-semibold text-[#6a6a6a]">외부 링크 / 플랫폼별 수치</legend>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#484848] mb-1">홈페이지</label>
              <input type="url" value={homepageUrl} onChange={e => setHomepageUrl(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-[#dddddd] text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#484848] mb-1">블로그</label>
              <input type="url" value={blogUrl} onChange={e => setBlogUrl(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-[#dddddd] text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#484848] mb-1">Instagram</label>
              <input type="url" value={instagramUrl} onChange={e => setInstagramUrl(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-[#dddddd] text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
            <div>
              <label className="block text-xs font-medium text-[#484848] mb-1">Naver 리뷰 수</label>
              <input type="number" min={0} value={naverReviewCount} onChange={e => setNaverReviewCount(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-[#dddddd] text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#484848] mb-1">Kakao 평점 (0~5)</label>
              <input type="number" step="0.1" min={0} max={5} value={kakaoRating} onChange={e => setKakaoRating(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-[#dddddd] text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#484848] mb-1">Kakao 리뷰 수</label>
              <input type="number" min={0} value={kakaoReviewCount} onChange={e => setKakaoReviewCount(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-[#dddddd] text-sm" />
            </div>
          </div>
          <p className="mt-2 text-[11px] text-[#9a9a9a]">
            Google 평점/리뷰수는 Places API로 자동 수집됩니다. Naver/Kakao 는 공식 API가 없어 수동 입력입니다.
          </p>
        </fieldset>

        {/* 서비스 */}
        <div>
          <h2 className="text-base font-semibold text-[#222222] mb-2">서비스</h2>
          {services.map((s, i) => (
            <div key={i} className="grid grid-cols-3 gap-2 mb-2">
              <input placeholder="서비스명" value={s.name} onChange={e => { const next = [...services]; next[i] = { ...next[i], name: e.target.value }; setServices(next) }} className="h-10 px-3 rounded-lg border border-[#dddddd] text-sm" />
              <input placeholder="설명" value={s.description ?? ''} onChange={e => { const next = [...services]; next[i] = { ...next[i], description: e.target.value }; setServices(next) }} className="h-10 px-3 rounded-lg border border-[#dddddd] text-sm" />
              <input placeholder="가격대" value={s.priceRange ?? ''} onChange={e => { const next = [...services]; next[i] = { ...next[i], priceRange: e.target.value }; setServices(next) }} className="h-10 px-3 rounded-lg border border-[#dddddd] text-sm" />
            </div>
          ))}
          <button onClick={() => setServices([...services, { name: '', description: '', priceRange: '' }])} className="text-sm text-[#00a67c]">+ 서비스 추가</button>
        </div>

        {/* FAQ */}
        <div>
          <h2 className="text-base font-semibold text-[#222222] mb-2">FAQ</h2>
          {faqs.map((f, i) => (
            <div key={i} className="space-y-1 mb-3">
              <input placeholder="질문" value={f.question} onChange={e => { const next = [...faqs]; next[i] = { ...next[i], question: e.target.value }; setFaqs(next) }} className="w-full h-10 px-3 rounded-lg border border-[#dddddd] text-sm" />
              <input placeholder="답변" value={f.answer} onChange={e => { const next = [...faqs]; next[i] = { ...next[i], answer: e.target.value }; setFaqs(next) }} className="w-full h-10 px-3 rounded-lg border border-[#dddddd] text-sm" />
            </div>
          ))}
          <button onClick={() => setFaqs([...faqs, { question: '', answer: '' }])} className="text-sm text-[#00a67c]">+ FAQ 추가</button>
        </div>

        <div>
          <label className="block text-sm font-medium text-[#484848] mb-1">태그 (쉼표 구분)</label>
          <input type="text" value={tags} onChange={e => setTags(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-[#dddddd] text-sm" />
        </div>

        <div className="flex gap-3">
          <button onClick={() => router.back()} className="h-12 px-6 rounded-lg border border-[#dddddd] text-[#484848]">취소</button>
          <button onClick={handleSave} disabled={saving} className="h-12 px-6 rounded-lg bg-[#222222] text-white font-medium disabled:opacity-50">
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}
