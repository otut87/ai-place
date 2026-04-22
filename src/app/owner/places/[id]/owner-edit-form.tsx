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
  /** AI Place keyword_bank 에서 sector 기준으로 뽑은 후보 키워드 (최대 20개). */
  suggestedKeywords?: string[]
}

export function OwnerEditForm({ placeId, initial, suggestedKeywords = [] }: Props) {
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
  const [, setImages] = useState<PlaceImageItem[]>(initial.images)
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

  const descValid = description.length >= 40 && description.length <= 60

  return (
    <form onSubmit={handleSubmit} className="edit-form-stack">
      {/* 기본 정보 */}
      <section className="form-card">
        <h2 className="form-section-title">기본 정보</h2>
        <div className="field">
          <label className="lbl">업체명</label>
          <input value={initial.name} disabled />
          <p className="hint">업체명 변경은 관리자 문의가 필요합니다.</p>
        </div>
        <div className="field">
          <label className="lbl">영문 이름</label>
          <input value={nameEn} onChange={e => setNameEn(e.target.value)} />
        </div>
        <div className="field">
          <label className="lbl">주소</label>
          <input value={initial.address} disabled />
        </div>
        <div className="field">
          <label className="lbl">
            소개 문구
            <span className={`form-counter${descValid ? ' ok' : ''}`}>
              {description.length} / 60자 (권장 40~60)
            </span>
          </label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} maxLength={100} />
        </div>
      </section>

      {/* 연락처·영업시간 */}
      <section className="form-card">
        <h2 className="form-section-title">연락처 · 영업시간</h2>
        <div className="field">
          <label className="lbl">전화번호</label>
          <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="041-123-4567" />
        </div>
        <div className="field">
          <label className="lbl">영업시간 <span className="form-counter">한 줄에 하나</span></label>
          <textarea
            value={hoursText}
            onChange={e => setHoursText(e.target.value)}
            rows={4}
            placeholder={'Mo 09:00-18:00\nTu 09:00-18:00'}
            style={{ fontFamily: 'var(--mono)', fontSize: 13 }}
          />
        </div>
      </section>

      {/* 서비스 */}
      <section className="form-card">
        <h2 className="form-section-title">제공 서비스</h2>
        <div className="repeat-list">
          {services.map((s, i) => (
            <div key={i} className="repeat-row grid-3">
              <input placeholder="서비스명" value={s.name} onChange={e => { const next = [...services]; next[i] = { ...next[i], name: e.target.value }; setServices(next) }} />
              <input placeholder="설명" value={s.description} onChange={e => { const next = [...services]; next[i] = { ...next[i], description: e.target.value }; setServices(next) }} />
              <div className="repeat-col-with-remove">
                <input placeholder="가격대" value={s.priceRange} onChange={e => { const next = [...services]; next[i] = { ...next[i], priceRange: e.target.value }; setServices(next) }} />
                <button type="button" className="repeat-remove" onClick={() => setServices(services.filter((_, j) => j !== i))} aria-label="서비스 삭제">✕</button>
              </div>
            </div>
          ))}
        </div>
        <button type="button" className="form-add-btn" onClick={() => setServices([...services, { name: '', description: '', priceRange: '' }])}>+ 서비스 추가</button>
      </section>

      {/* FAQ */}
      <section className="form-card">
        <h2 className="form-section-title">자주 묻는 질문</h2>
        <div className="repeat-list">
          {faqs.map((f, i) => (
            <div key={i} className="repeat-faq">
              <div className="repeat-faq-q">
                <input placeholder="질문 (? 로 끝나게)" value={f.question} onChange={e => { const next = [...faqs]; next[i] = { ...next[i], question: e.target.value }; setFaqs(next) }} />
                <button type="button" className="repeat-remove" onClick={() => setFaqs(faqs.filter((_, j) => j !== i))} aria-label="FAQ 삭제">✕</button>
              </div>
              <input placeholder="답변" value={f.answer} onChange={e => { const next = [...faqs]; next[i] = { ...next[i], answer: e.target.value }; setFaqs(next) }} />
            </div>
          ))}
        </div>
        <button type="button" className="form-add-btn" onClick={() => setFaqs([...faqs, { question: '', answer: '' }])}>+ FAQ 추가</button>
      </section>

      {/* 태그·추천·강점 */}
      <section className="form-card">
        <h2 className="form-section-title">태그 · 추천 대상 · 강점</h2>
        <div className="field">
          <label className="lbl">태그 <span className="form-counter">쉼표로 구분, 최대 10개</span></label>
          <input value={tagsText} onChange={e => setTagsText(e.target.value)} placeholder="여드름, 레이저" />

          {suggestedKeywords.length > 0 && (
            <KeywordSuggestBox
              keywords={suggestedKeywords}
              currentTags={tagsText.split(',').map(t => t.trim()).filter(Boolean)}
              onAddTag={(kw) => {
                const currents = new Set(tagsText.split(',').map(t => t.trim()).filter(Boolean))
                if (currents.has(kw)) return
                currents.add(kw)
                setTagsText(Array.from(currents).join(', '))
              }}
              onAddFaq={(kw) => {
                const q = `${kw} 관련해서 자주 묻는 질문은 무엇인가요?`
                setFaqs([...faqs, { question: q, answer: '' }])
              }}
            />
          )}
        </div>
        <div className="field">
          <label className="lbl">추천 대상 <span className="form-counter">쉼표로 구분</span></label>
          <input value={recommendedForText} onChange={e => setRecommendedForText(e.target.value)} placeholder="직장인, 학생" />
        </div>
        <div className="field">
          <label className="lbl">강점 <span className="form-counter">쉼표로 구분</span></label>
          <input value={strengthsText} onChange={e => setStrengthsText(e.target.value)} placeholder="20년 경력, 야간 진료" />
        </div>
      </section>

      {/* 사진 */}
      <section className="form-card">
        <div className="form-section-head">
          <h2 className="form-section-title">사진 <span className="form-counter">Google Places 자동</span></h2>
          <button
            type="button"
            onClick={handleRefreshPhotos}
            disabled={photoLoading}
            className="btn ghost sm"
          >
            {photoLoading ? '불러오는 중…' : '🔄 다시 불러오기'}
          </button>
        </div>
        {photoRefs.length === 0 ? (
          <p className="form-inline-info">
            Google Places 에 등록된 사진이 없거나 매칭에 실패했습니다. Google Business Profile 에 사진을 올린 뒤 &ldquo;다시 불러오기&rdquo;를 눌러 주세요.
          </p>
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
                      onChange={e => {
                        setSelectedPhotos(prev => {
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
            <p className="hint" style={{ marginTop: 8, marginBottom: 0 }}>
              {selectedPhotos.size} / {photoRefs.length} 장 선택됨
            </p>
          </>
        )}
      </section>

      {/* 외부 프로필 */}
      <section className="form-card">
        <h2 className="form-section-title">외부 프로필 링크 <span className="form-counter">Schema.org sameAs</span></h2>
        <div className="grid-2">
          <div className="field">
            <label className="lbl">네이버 플레이스</label>
            <input type="url" value={naverPlaceUrl} onChange={e => setNaverPlaceUrl(e.target.value)} />
          </div>
          <div className="field">
            <label className="lbl">카카오맵</label>
            <input type="url" value={kakaoMapUrl} onChange={e => setKakaoMapUrl(e.target.value)} />
          </div>
          <div className="field">
            <label className="lbl">Google Business Profile</label>
            <input type="url" value={googleBusinessUrl} onChange={e => setGoogleBusinessUrl(e.target.value)} />
          </div>
          <div className="field">
            <label className="lbl">홈페이지</label>
            <input type="url" value={homepageUrl} onChange={e => setHomepageUrl(e.target.value)} />
          </div>
          <div className="field">
            <label className="lbl">블로그</label>
            <input type="url" value={blogUrl} onChange={e => setBlogUrl(e.target.value)} />
          </div>
          <div className="field">
            <label className="lbl">인스타그램</label>
            <input type="url" value={instagramUrl} onChange={e => setInstagramUrl(e.target.value)} />
          </div>
        </div>
      </section>

      {message && <div className="owner-banner ok" role="status">{message}</div>}
      {error && <div className="owner-banner danger" role="alert">{error}</div>}

      <div className="form-submit-bar">
        <button type="submit" disabled={pending} className="btn accent lg">
          {pending ? '저장 중…' : '변경 사항 저장'}
        </button>
      </div>
    </form>
  )
}

function extractRefFromProxyUrl(url: string): string | null {
  const m = url.match(/[?&]ref=([^&]+)/)
  if (!m) return null
  try { return decodeURIComponent(m[1]) } catch { return null }
}

// ── 추천 키워드 박스 ────────────────────────────────────────────────
// AI Place keyword_bank 에서 sector 기준으로 뽑은 후보.
// 오너가 칩 클릭 → 태그 추가 / FAQ 질문 자동 생성.
interface KeywordSuggestBoxProps {
  keywords: string[]
  currentTags: string[]
  onAddTag: (keyword: string) => void
  onAddFaq: (keyword: string) => void
}

function KeywordSuggestBox({ keywords, currentTags, onAddTag, onAddFaq }: KeywordSuggestBoxProps) {
  const currentSet = new Set(currentTags)
  return (
    <div className="keyword-suggest">
      <div className="keyword-suggest-head">
        <h4>추천 키워드 <span>· {keywords.length}개 · 내 업종 AEO 풀</span></h4>
      </div>
      <p>
        내 업종에서 AI 검색이 자주 묻는 키워드예요. <b>+</b> 는 태그에 추가, <b>FAQ</b> 는 질문 초안을 아래 FAQ 섹션에 넣습니다.
      </p>
      <div className="keyword-chip-list">
        {keywords.map((kw) => {
          const isUsed = currentSet.has(kw)
          return (
            <span key={kw} className="keyword-chip-group">
              <button
                type="button"
                className={`keyword-chip${isUsed ? ' added' : ''}`}
                onClick={() => onAddTag(kw)}
                disabled={isUsed}
                title={isUsed ? '이미 태그에 있음' : '태그로 추가'}
              >
                {isUsed ? '✓' : '+'} {kw}
              </button>
              <button
                type="button"
                className="keyword-chip-action"
                onClick={() => onAddFaq(kw)}
                title="이 키워드로 FAQ 질문 초안 생성"
              >
                FAQ
              </button>
            </span>
          )
        })}
      </div>
    </div>
  )
}
