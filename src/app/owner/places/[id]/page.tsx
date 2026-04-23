// T-141/T-216 — 사장님 단일 업체 편집 페이지. place-edit.html 디자인 이식.
// 좌측 sticky 섹션 네비 + 우측 폼 + 상단 헤더(biz-logo + status pill + AEO ring).
// AEO score 는 /owner/places/[id]/dashboard 와 동일한 loadAeoSnapshotsForPlaces 사용.

import Link from 'next/link'
import { requireOwnerUser } from '@/lib/owner/auth'
import { getAdminClient } from '@/lib/supabase/admin-client'
import { canOwnerEdit } from '@/lib/owner/permissions'
import { getAvailableKeywords } from '@/lib/blog/keyword-bank'
import { loadAeoSnapshotsForPlaces } from '@/lib/owner/aeo-snapshot'
import { OwnerEditForm, type OwnerEditInitial } from './owner-edit-form'

interface Params {
  params: Promise<{ id: string }>
  searchParams: Promise<{ registered?: string; msg?: string }>
}

export const dynamic = 'force-dynamic'

function firstChar(name: string): string {
  const trimmed = name.trim()
  return trimmed.length > 0 ? Array.from(trimmed)[0] : '·'
}

function statusChip(status: string): { text: string; cls: string } {
  if (status === 'active') return { text: '공개 중', cls: '' }
  if (status === 'pending' || status === 'pending_review') return { text: '검수 중', cls: 'draft' }
  if (status === 'archived') return { text: '보관됨', cls: 'off' }
  if (status === 'rejected') return { text: '반려됨', cls: 'draft' }
  return { text: status, cls: 'draft' }
}

function formatUpdated(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\.\s?$/, '')
}

export default async function OwnerPlaceEditPage({ params, searchParams }: Params) {
  const user = await requireOwnerUser()
  const { id } = await params
  const { registered, msg } = await searchParams

  const supabase = getAdminClient()
  if (!supabase) {
    return (
      <div className="pe-page">
        <div className="pe-header" style={{ gridColumn: '1 / -1' }}>
          <div className="biz-info"><h1>DB 연결 실패</h1></div>
        </div>
      </div>
    )
  }

  const { data } = await supabase
    .from('places')
    .select([
      'id, name, name_en, slug, city, category, status, description,',
      'address, phone, opening_hours, tags, images, services, faqs,',
      'recommended_for, strengths, updated_at,',
      'naver_place_url, kakao_map_url, google_business_url, google_place_id,',
      'homepage_url, blog_url, instagram_url,',
      'owner_id, owner_email',
    ].join(' '))
    .eq('id', id)
    .single()

  const row = data as {
    id: string; name: string; name_en: string | null; slug: string
    city: string; category: string; status: string
    description: string | null; address: string; phone: string | null
    opening_hours: string[] | null; tags: string[] | null
    images: Array<{ url: string; alt: string; type: string }> | null
    services: Array<{ name: string; description?: string; priceRange?: string }> | null
    faqs: Array<{ question: string; answer: string }> | null
    recommended_for: string[] | null; strengths: string[] | null
    updated_at: string | null
    naver_place_url: string | null; kakao_map_url: string | null
    google_business_url: string | null; google_place_id: string | null
    homepage_url: string | null; blog_url: string | null; instagram_url: string | null
    owner_id: string | null; owner_email: string | null
  } | null

  if (!row) {
    return (
      <div className="pe-page">
        <div className="pe-crumb">
          <Link href="/owner/places">내 업체</Link>
          <span className="sep">›</span>
          <span className="cur">편집</span>
        </div>
        <div className="pe-header">
          <div className="biz-logo">·</div>
          <div className="biz-info">
            <h1>업체를 찾을 수 없어요</h1>
            <span className="slug">삭제되었거나 잘못된 링크입니다.</span>
          </div>
        </div>
      </div>
    )
  }
  if (!canOwnerEdit(row, { userId: user.id, email: user.email })) {
    return (
      <div className="pe-page">
        <div className="pe-crumb">
          <Link href="/owner/places">내 업체</Link>
          <span className="sep">›</span>
          <span className="cur">편집</span>
        </div>
        <div className="pe-header">
          <div className="biz-logo">·</div>
          <div className="biz-info">
            <h1>권한이 없어요</h1>
            <span className="slug">본인 소유 업체만 편집할 수 있습니다.</span>
          </div>
        </div>
      </div>
    )
  }

  // 추천 키워드 — sector 확정 후 키워드 뱅크에서 최대 20개 조회.
  const { data: secRow } = await supabase
    .from('category_sector')
    .select('sector_slug')
    .eq('category_slug', row.category)
    .maybeSingle()
  const sectorSlug = (secRow as { sector_slug: string } | null)?.sector_slug ?? null
  const suggestedKeywords = sectorSlug
    ? await getAvailableKeywords({ sector: sectorSlug, active: true, limit: 20 })
    : []

  // AEO snapshot — header 의 health ring + "보완 N건" 링크에 사용.
  const aeoSnapshots = await loadAeoSnapshotsForPlaces([row.id])
  const aeo = aeoSnapshots[0]

  const initial: OwnerEditInitial = {
    name: row.name,
    nameEn: row.name_en ?? '',
    address: row.address,
    description: row.description ?? '',
    phone: row.phone ?? '',
    openingHours: row.opening_hours ?? [],
    tags: row.tags ?? [],
    images: row.images ?? [],
    services: row.services ?? [],
    faqs: row.faqs ?? [],
    recommendedFor: row.recommended_for ?? [],
    strengths: row.strengths ?? [],
    naverPlaceUrl: row.naver_place_url ?? '',
    kakaoMapUrl: row.kakao_map_url ?? '',
    googleBusinessUrl: row.google_business_url ?? '',
    homepageUrl: row.homepage_url ?? '',
    blogUrl: row.blog_url ?? '',
    instagramUrl: row.instagram_url ?? '',
    googlePlaceId: row.google_place_id ?? '',
  }

  const chip = statusChip(row.status)
  const updated = formatUpdated(row.updated_at)
  const publicUrl = `/${row.city}/${row.category}/${row.slug}`
  const citationsUrl = `/owner/places/${row.id}/dashboard`

  // AEO ring 계산 — 원주 2πr = 2π*25 ≈ 157.08. score/100 비율로 stroke-dasharray.
  const ringCircumference = 2 * Math.PI * 25
  const ringDash = aeo ? (aeo.score / 100) * ringCircumference : 0

  return (
    <div className="pe-page">
      <div className="pe-crumb">
        <Link href="/owner/places">내 업체</Link>
        <span className="sep">›</span>
        <span>{row.name}</span>
        <span className="sep">›</span>
        <span className="cur">편집</span>
      </div>

      {/* ========== HEADER ========== */}
      <header className="pe-header">
        <div className="biz-logo">{firstChar(row.name)}</div>
        <div className="biz-info">
          <h1>
            {row.name}
            <span className={`status ${chip.cls}`}>{chip.text}</span>
          </h1>
          <span className="slug">
            <span className="dim">/{row.city}/{row.category}/</span>
            {row.slug}
            {updated && (
              <> <span className="dim">·</span> 최근 수정 {updated}</>
            )}
          </span>
        </div>
        {aeo && (
          <div className="health">
            <div className="pe-ring">
              <svg viewBox="0 0 60 60" aria-hidden="true">
                <circle className="track" cx="30" cy="30" r="25" />
                <circle
                  className="val"
                  cx="30" cy="30" r="25"
                  strokeDasharray={`${ringDash} ${ringCircumference - ringDash}`}
                />
              </svg>
              <div className="num">{aeo.score}</div>
            </div>
            <div className="hmeta">
              <b>AI 가독성</b>
              <span>
                {aeo.score} / 100
                {aeo.topIssues.length > 0 ? (
                  <> · <Link href={citationsUrl} className="go">{aeo.topIssues.length}개 보완</Link></>
                ) : (
                  <> · <span style={{ color: 'var(--good)' }}>완료</span></>
                )}
              </span>
            </div>
          </div>
        )}
      </header>

      {registered && msg && (
        <div
          className="pe-top-actions"
          role="status"
          style={{
            padding: '12px 16px',
            background: 'color-mix(in oklab, var(--good) 8%, var(--card))',
            border: '1px solid color-mix(in oklab, var(--good) 28%, transparent)',
            borderRadius: 10,
            color: 'var(--good)',
            fontSize: 13,
            display: 'flex',
            gap: 8,
            alignItems: 'center',
          }}
        >
          <span>✅ {msg}</span>
        </div>
      )}

      <div className="pe-top-actions">
        <Link className="back" href="/owner/places">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          업체 목록으로
        </Link>
        <div className="right-bits">
          {row.status === 'active' && (
            <a
              className="btn-ghost"
              href={publicUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              공개 페이지 ↗
            </a>
          )}
          <Link className="btn-ghost" href={citationsUrl}>
            📊 대시보드
          </Link>
        </div>
      </div>

      <OwnerEditForm
        placeId={row.id}
        placeCity={row.city}
        placeCategory={row.category}
        placeSlug={row.slug}
        initial={initial}
        suggestedKeywords={suggestedKeywords.map((k) => k.keyword)}
        publicHref={row.status === 'active' ? publicUrl : undefined}
        citationsHref={citationsUrl}
      />
    </div>
  )
}
