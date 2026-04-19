// 사장님 단일 업체 편집 페이지 — 등록 폼과 동일 수준의 전체 필드 편집.
import { requireOwnerUser } from '@/lib/owner/auth'
import { getAdminClient } from '@/lib/supabase/admin-client'
import { canOwnerEdit } from '@/lib/owner/permissions'
import { AdminLink } from '@/components/admin/admin-link'
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
  if (!supabase) return <div className="p-6 text-sm text-red-600">DB 연결 실패</div>

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

  if (!row) return <div className="p-6 text-sm text-red-600">업체를 찾을 수 없습니다.</div>
  if (!canOwnerEdit(row, { userId: user.id, email: user.email })) {
    return <div className="p-6 text-sm text-red-600">본인 소유 업체가 아닙니다.</div>
  }

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

  return (
    <div className="mx-auto max-w-2xl p-6">
      {registered && msg && (
        <div className="mb-4 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">
          ✅ {msg}
        </div>
      )}
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">{row.name} 편집</h1>
        <div className="flex items-center gap-3 text-xs">
          <AdminLink href={`/owner/places/${row.id}/dashboard`} className="text-[#008060] underline">
            📊 대시보드
          </AdminLink>
          <AdminLink href="/owner" className="text-[#4c1d95] underline">← 내 업체</AdminLink>
        </div>
      </div>
      <p className="mb-4 text-xs text-[#6a6a6a]">
        공개 페이지: /{row.city}/{row.category}/{row.slug} · 상태: {row.status}
      </p>
      <OwnerEditForm placeId={row.id} initial={initial} />
    </div>
  )
}
