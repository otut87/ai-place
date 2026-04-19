'use client'

// 사장님 단일 업체 편집 폼 — 등록 폼과 동일 수준의 필드 + Google 사진 재불러오기.
import { useState, useTransition } from 'react'
import { updateOwnerPlace } from '@/lib/actions/owner-places'
import { enrichFromGoogle } from '@/lib/actions/register-place'

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
  initial: OwnerEditInitial
}

export function OwnerEditForm({ placeId, initial }: Props) {
  const [pending, startTransition] = useTransition()
  const [photoLoading, setPhotoLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // 필드 상태
  const [nameEn, setNameEn] = useState(initial.nameEn)
  const [description, setDescription] = useState(initial.description)
  const [phone, setPhone] = useState(initial.phone)
  const [hoursText, setHoursText] = useState(initial.openingHours.join('\n'))
  const [tagsText, setTagsText] = useState(initial.tags.join(', '))
  const [services, setServices] = useState(
    initial.services.length > 0
      ? initial.services.map(s => ({ name: s.name, description: s.description ?? '', priceRange: s.priceRange ?? '' }))
      : [{ name: '', description: '', priceRange: '' }],
  )
  const [faqs, setFaqs] = useState(
    initial.faqs.length > 0
      ? initial.faqs
      : [{ question: '', answer: '' }, { question: '', answer: '' }, { question: '', answer: '' }],
  )
  const [recommendedForText, setRecommendedForText] = useState(initial.recommendedFor.join(', '))
  const [strengthsText, setStrengthsText] = useState(initial.strengths.join(', '))
  const [naverPlaceUrl, setNaverPlaceUrl] = useState(initial.naverPlaceUrl)
  const [kakaoMapUrl, setKakaoMapUrl] = useState(initial.kakaoMapUrl)
  const [googleBusinessUrl, setGoogleBusinessUrl] = useState(initial.googleBusinessUrl)
  const [homepageUrl, setHomepageUrl] = useState(initial.homepageUrl)
  const [blogUrl, setBlogUrl] = useState(initial.blogUrl)
  const [instagramUrl, setInstagramUrl] = useState(initial.instagramUrl)

  // 이미지 상태 — Google 에서 다시 불러올 수 있음. 현재 저장된 것 + 새로 가져온 refs 병합.
  const [images, setImages] = useState<PlaceImageItem[]>(initial.images)
  const [photoRefs, setPhotoRefs] = useState<string[]>(
    initial.images
      .map(i => extractRefFromProxyUrl(i.url))
      .filter((r): r is string => !!r),
  )
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(
    new Set(initial.images.map(i => extractRefFromProxyUrl(i.url)).filter((r): r is string => !!r)),
  )

  async function handleRefreshPhotos() {
    setPhotoLoading(true)
    setError(null)
    const r = await enrichFromGoogle({ name: initial.name, address: initial.address })
    setPhotoLoading(false)
    if (!r.success) {
      setError(r.error)
      return
    }
    if (!r.data.matched || !r.data.photoRefs || r.data.photoRefs.length === 0) {
      setMessage('Google Places 에서 가져올 새 사진이 없습니다.')
      return
    }
    // 기존 + 신규 병합, 중복 제거
    const merged = Array.from(new Set([...photoRefs, ...r.data.photoRefs]))
    setPhotoRefs(merged)
    // 새로 가져온 것은 기본 선택
    setSelectedPhotos(prev => {
      const next = new Set(prev)
      for (const ref of r.data.photoRefs!) next.add(ref)
      return next
    })
    setMessage(`Google 사진 ${r.data.photoRefs.length}장 불러왔습니다. 원하는 사진을 체크하세요.`)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)
    setError(null)

    // 선택된 photoRefs → PlaceImage[]
    const nextImages: PlaceImageItem[] = [...selectedPhotos]
      .filter(ref => photoRefs.includes(ref))
      .map(ref => ({
        url: `/api/places/photo?ref=${encodeURIComponent(ref)}&w=1200`,
        alt: initial.name,
        type: 'exterior',
      }))

    const patch: Record<string, unknown> = {
      name_en: nameEn,
      description,
      phone,
      opening_hours: hoursText.split(/\r?\n/).map(s => s.trim()).filter(Boolean),
      tags: tagsText.split(',').map(t => t.trim()).filter(Boolean),
      services: services.filter(s => s.name.trim()),
      faqs: faqs.filter(f => f.question.trim() && f.answer.trim()),
      recommended_for: recommendedForText.split(',').map(s => s.trim()).filter(Boolean),
      strengths: strengthsText.split(',').map(s => s.trim()).filter(Boolean),
      images: nextImages,
      naver_place_url: naverPlaceUrl,
      kakao_map_url: kakaoMapUrl,
      google_business_url: googleBusinessUrl,
      homepage_url: homepageUrl,
      blog_url: blogUrl,
      instagram_url: instagramUrl,
    }

    startTransition(async () => {
      const r = await updateOwnerPlace(placeId, patch)
      if (r.success) {
        setMessage(`${r.fieldsChanged ?? 0}개 필드가 업데이트되었습니다.`)
        // 이미지 변경 반영을 위해 로컬 상태도 동기화
        setImages(nextImages)
      } else {
        setError(r.error ?? '업데이트 실패')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* 기본 정보 */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-[#222222]">기본 정보</h2>
        <div>
          <label className="mb-1 block text-xs font-medium">업체명</label>
          <input value={initial.name} disabled className="w-full h-10 rounded-md border border-[#eeeeee] bg-[#f8f8f8] px-3 text-sm text-[#9a9a9a]" />
          <p className="mt-1 text-[10px] text-[#9a9a9a]">업체명 변경은 관리자 문의가 필요합니다.</p>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">영문 이름</label>
          <input value={nameEn} onChange={e => setNameEn(e.target.value)} className="w-full h-10 rounded-md border border-[#dddddd] px-3 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">주소</label>
          <input value={initial.address} disabled className="w-full h-10 rounded-md border border-[#eeeeee] bg-[#f8f8f8] px-3 text-sm text-[#9a9a9a]" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">
            소개 문구 <span className={`ml-2 text-[10px] ${description.length >= 40 && description.length <= 60 ? 'text-green-600' : 'text-[#9a9a9a]'}`}>
              {description.length}/60자 (권장 40~60)
            </span>
          </label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} maxLength={100} className="w-full rounded-md border border-[#dddddd] px-3 py-2 text-sm" />
        </div>
      </section>

      {/* 연락처 */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-[#222222]">연락처 · 영업시간</h2>
        <div>
          <label className="mb-1 block text-xs font-medium">전화번호</label>
          <input value={phone} onChange={e => setPhone(e.target.value)} className="w-full h-10 rounded-md border border-[#dddddd] px-3 text-sm" placeholder="041-123-4567" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">영업시간 (한 줄에 하나)</label>
          <textarea value={hoursText} onChange={e => setHoursText(e.target.value)} rows={4} className="w-full rounded-md border border-[#dddddd] px-3 py-2 font-mono text-xs" placeholder={"Mo 09:00-18:00\nTu 09:00-18:00"} />
        </div>
      </section>

      {/* 서비스 */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-[#222222]">제공 서비스</h2>
        {services.map((s, i) => (
          <div key={i} className="grid grid-cols-3 gap-2">
            <input placeholder="서비스명" value={s.name} onChange={e => { const next = [...services]; next[i] = { ...next[i], name: e.target.value }; setServices(next) }} className="h-10 rounded-md border border-[#dddddd] px-3 text-sm" />
            <input placeholder="설명" value={s.description} onChange={e => { const next = [...services]; next[i] = { ...next[i], description: e.target.value }; setServices(next) }} className="h-10 rounded-md border border-[#dddddd] px-3 text-sm" />
            <div className="flex gap-1">
              <input placeholder="가격대" value={s.priceRange} onChange={e => { const next = [...services]; next[i] = { ...next[i], priceRange: e.target.value }; setServices(next) }} className="flex-1 h-10 rounded-md border border-[#dddddd] px-3 text-sm" />
              <button type="button" onClick={() => setServices(services.filter((_, j) => j !== i))} className="h-10 px-2 text-xs text-red-500 hover:bg-red-50 rounded">✕</button>
            </div>
          </div>
        ))}
        <button type="button" onClick={() => setServices([...services, { name: '', description: '', priceRange: '' }])} className="text-xs text-[#008060]">+ 서비스 추가</button>
      </section>

      {/* FAQ */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-[#222222]">자주 묻는 질문</h2>
        {faqs.map((f, i) => (
          <div key={i} className="space-y-1">
            <div className="flex gap-1">
              <input placeholder="질문 (? 로 끝나게)" value={f.question} onChange={e => { const next = [...faqs]; next[i] = { ...next[i], question: e.target.value }; setFaqs(next) }} className="flex-1 h-10 rounded-md border border-[#dddddd] px-3 text-sm" />
              <button type="button" onClick={() => setFaqs(faqs.filter((_, j) => j !== i))} className="h-10 px-2 text-xs text-red-500 hover:bg-red-50 rounded">✕</button>
            </div>
            <input placeholder="답변" value={f.answer} onChange={e => { const next = [...faqs]; next[i] = { ...next[i], answer: e.target.value }; setFaqs(next) }} className="w-full h-10 rounded-md border border-[#dddddd] px-3 text-sm" />
          </div>
        ))}
        <button type="button" onClick={() => setFaqs([...faqs, { question: '', answer: '' }])} className="text-xs text-[#008060]">+ FAQ 추가</button>
      </section>

      {/* 태그·추천·강점 */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-[#222222]">태그 · 추천 대상 · 강점</h2>
        <div>
          <label className="mb-1 block text-xs font-medium">태그 (쉼표로 구분, 최대 10개)</label>
          <input value={tagsText} onChange={e => setTagsText(e.target.value)} className="w-full h-10 rounded-md border border-[#dddddd] px-3 text-sm" placeholder="여드름, 레이저" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">추천 대상 (쉼표로 구분)</label>
          <input value={recommendedForText} onChange={e => setRecommendedForText(e.target.value)} className="w-full h-10 rounded-md border border-[#dddddd] px-3 text-sm" placeholder="직장인, 학생" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">강점 (쉼표로 구분)</label>
          <input value={strengthsText} onChange={e => setStrengthsText(e.target.value)} className="w-full h-10 rounded-md border border-[#dddddd] px-3 text-sm" placeholder="20년 경력, 야간 진료" />
        </div>
      </section>

      {/* 사진 */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#222222]">사진 <span className="text-xs text-[#9a9a9a]">(Google Places 자동)</span></h2>
          <button
            type="button"
            onClick={handleRefreshPhotos}
            disabled={photoLoading}
            className="text-xs text-[#008060] hover:underline disabled:opacity-50"
          >
            {photoLoading ? '불러오는 중...' : '🔄 Google 사진 다시 불러오기'}
          </button>
        </div>
        {photoRefs.length === 0 ? (
          <p className="text-xs text-[#9a9a9a] p-3 rounded-lg bg-[#fafafa] border border-dashed border-[#dddddd]">
            Google Places 에 등록된 사진이 없거나 매칭 실패했습니다. Google Business Profile 에 사진을 올린 뒤 &ldquo;다시 불러오기&rdquo;를 눌러 주세요.
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
            <p className="text-xs text-[#9a9a9a]">{selectedPhotos.size} / {photoRefs.length} 장 선택됨</p>
          </>
        )}
      </section>

      {/* 외부 프로필 */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-[#222222]">외부 프로필 링크 (sameAs)</h2>
        <div>
          <label className="mb-1 block text-xs font-medium">네이버 플레이스</label>
          <input type="url" value={naverPlaceUrl} onChange={e => setNaverPlaceUrl(e.target.value)} className="w-full h-10 rounded-md border border-[#dddddd] px-3 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">카카오맵</label>
          <input type="url" value={kakaoMapUrl} onChange={e => setKakaoMapUrl(e.target.value)} className="w-full h-10 rounded-md border border-[#dddddd] px-3 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">Google Business Profile</label>
          <input type="url" value={googleBusinessUrl} onChange={e => setGoogleBusinessUrl(e.target.value)} className="w-full h-10 rounded-md border border-[#dddddd] px-3 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">홈페이지</label>
          <input type="url" value={homepageUrl} onChange={e => setHomepageUrl(e.target.value)} className="w-full h-10 rounded-md border border-[#dddddd] px-3 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">블로그</label>
          <input type="url" value={blogUrl} onChange={e => setBlogUrl(e.target.value)} className="w-full h-10 rounded-md border border-[#dddddd] px-3 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">인스타그램</label>
          <input type="url" value={instagramUrl} onChange={e => setInstagramUrl(e.target.value)} className="w-full h-10 rounded-md border border-[#dddddd] px-3 text-sm" />
        </div>
      </section>

      {message && <p className="text-xs text-green-700">{message}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="h-11 w-full rounded-lg bg-[#008060] px-4 text-sm font-medium text-white hover:bg-[#006e52] disabled:opacity-50"
      >
        {pending ? '저장 중...' : '변경 사항 저장'}
      </button>
    </form>
  )
}

function extractRefFromProxyUrl(url: string): string | null {
  const m = url.match(/[?&]ref=([^&]+)/)
  if (!m) return null
  try { return decodeURIComponent(m[1]) } catch { return null }
}
