// 사장님 단일 업체 편집 페이지 — owner-dashboard.css 토큰으로 통일.
import Link from 'next/link'
import { requireOwnerUser } from '@/lib/owner/auth'
import { getAdminClient } from '@/lib/supabase/admin-client'
import { canOwnerEdit } from '@/lib/owner/permissions'
import { getAvailableKeywords } from '@/lib/blog/keyword-bank'
import { PageHeader } from '../../_components/page-header'
import { OwnerEditForm, type OwnerEditInitial } from './owner-edit-form'

interface Params {
  params: Promise<{ id: string }>
  searchParams: Promise<{ registered?: string; msg?: string }>
}

export const dynamic = 'force-dynamic'

export default async function OwnerPlaceEditPage({ params, searchParams }: Params) {
  const user = await requireOwnerUser()
  const { id } = await params
  const { registered, msg } = await searchParams

  const supabase = getAdminClient()
  if (!supabase) {
    return (
      <section className="wrap">
        <div className="owner-banner danger" role="alert">
          <span>⚠️ 데이터베이스 연결 실패</span>
        </div>
      </section>
    )
  }

  const { data } = await supabase
    .from('places')
    .select([
      'id, name, name_en, slug, city, category, status, description,',
      'address, phone, opening_hours, tags, images, services, faqs,',
      'recommended_for, strengths,',
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
    naver_place_url: string | null; kakao_map_url: string | null
    google_business_url: string | null; google_place_id: string | null
    homepage_url: string | null; blog_url: string | null; instagram_url: string | null
    owner_id: string | null; owner_email: string | null
  } | null

  if (!row) {
    return (
      <section className="wrap">
        <PageHeader
          title="업체를 찾을 수 없어요"
          subtitle="삭제되었거나 잘못된 링크입니다."
          back={{ href: '/owner', label: '내 업체 목록' }}
        />
      </section>
    )
  }
  if (!canOwnerEdit(row, { userId: user.id, email: user.email })) {
    return (
      <section className="wrap">
        <PageHeader
          title="권한이 없어요"
          subtitle="본인 소유 업체만 편집할 수 있습니다."
          back={{ href: '/owner', label: '내 업체 목록' }}
        />
      </section>
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

  const statusLabel = row.status === 'active' ? '공개' : row.status === 'pending' ? '검토 중' : row.status

  return (
    <section className="wrap">
      {registered && msg && (
        <div className="owner-banner ok" role="status" style={{ marginBottom: 20 }}>
          <span>✅ {msg}</span>
        </div>
      )}

      <PageHeader
        title={<>{row.name} <span className="it">편집</span></>}
        subtitle={
          <>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--muted)' }}>
              /{row.city}/{row.category}/{row.slug}
            </span>
            {' · '}
            <span className={`grade-pill ${row.status === 'active' ? 'A' : 'C'}`}>{statusLabel}</span>
          </>
        }
        back={{ href: '/owner', label: '내 업체 목록' }}
        actions={
          <>
            <Link className="btn ghost sm" href={`/owner/places/${row.id}/dashboard`}>
              📊 인용 테스트
            </Link>
            {row.status === 'active' && (
              <a
                className="btn ghost sm"
                href={`/${row.city}/${row.category}/${row.slug}`}
                target="_blank"
                rel="noopener"
              >
                공개 페이지 ↗
              </a>
            )}
          </>
        }
      />

      <OwnerEditForm
        placeId={row.id}
        initial={initial}
        suggestedKeywords={suggestedKeywords.map((k) => k.keyword)}
      />
    </section>
  )
}
