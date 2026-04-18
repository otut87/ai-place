// T-054 — 사장님 단일 업체 편집 페이지 (서버 컴포넌트 → 클라이언트 폼 delegation)
import { requireOwnerUser } from '@/lib/owner/auth'
import { getAdminClient } from '@/lib/supabase/admin-client'
import { canOwnerEdit } from '@/lib/owner/permissions'
import { AdminLink } from '@/components/admin/admin-link'
import { OwnerEditForm } from './owner-edit-form'

interface Params {
  params: Promise<{ id: string }>
}

export const dynamic = 'force-dynamic'

export default async function OwnerPlaceEditPage({ params }: Params) {
  const user = await requireOwnerUser()
  const { id } = await params

  const supabase = getAdminClient()
  if (!supabase) return <div className="p-6 text-sm text-red-600">DB 연결 실패</div>

  const { data } = await supabase
    .from('places')
    .select('id, name, slug, city, category, status, description, phone, opening_hours, tags, images, owner_id, owner_email')
    .eq('id', id)
    .single()

  const row = data as {
    id: string; name: string; slug: string; city: string; category: string; status: string;
    description: string | null; phone: string | null; opening_hours: string[] | null;
    tags: string[] | null; images: unknown;
    owner_id: string | null; owner_email: string | null;
  } | null

  if (!row) return <div className="p-6 text-sm text-red-600">업체를 찾을 수 없습니다.</div>
  if (!canOwnerEdit(row, { userId: user.id, email: user.email })) {
    return <div className="p-6 text-sm text-red-600">본인 소유 업체가 아닙니다.</div>
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">{row.name} 편집</h1>
        <AdminLink href="/owner" className="text-xs text-[#4c1d95] underline">← 내 업체</AdminLink>
      </div>
      <p className="mb-4 text-xs text-[#6a6a6a]">
        공개 페이지: /{row.city}/{row.category}/{row.slug} · 상태: {row.status}
      </p>
      <OwnerEditForm
        placeId={row.id}
        initial={{
          description: row.description ?? '',
          phone: row.phone ?? '',
          opening_hours: row.opening_hours ?? [],
          tags: row.tags ?? [],
        }}
      />
    </div>
  )
}
