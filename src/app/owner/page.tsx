// T-054 — 사장님 셀프 포털 홈.
// 로그인된 사용자 본인 소유 업체 목록. 각 업체의 편집 페이지로 이동.
import { AdminLink } from '@/components/admin/admin-link'
import { requireOwnerUser } from '@/lib/owner/auth'
import { listOwnerPlaces } from '@/lib/actions/owner-places'

export const dynamic = 'force-dynamic'

interface Params {
  searchParams: Promise<{ registered?: string; msg?: string }>
}

export default async function OwnerPortalPage({ searchParams }: Params) {
  const user = await requireOwnerUser()
  const places = await listOwnerPlaces()
  const { registered, msg } = await searchParams

  return (
    <div className="mx-auto max-w-3xl p-6">
      {registered && msg && (
        <div className="mb-4 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">
          ✅ {msg}
        </div>
      )}
      <header className="mb-4">
        <h1 className="text-xl font-semibold">내 업체 관리</h1>
        <p className="text-xs text-[#6a6a6a]">로그인: {user.email ?? user.id}</p>
      </header>

      {places.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[#dddddd] bg-white p-8 text-center">
          <p className="text-sm text-[#484848]">아직 등록된 업체가 없습니다.</p>
          <p className="mt-1 text-xs text-[#6a6a6a]">업체명을 검색하면 정보가 자동으로 채워져요 — 30초면 끝.</p>
          <AdminLink
            href="/owner/places/new"
            className="mt-4 inline-flex h-10 items-center rounded-lg bg-[#008060] px-4 text-sm font-medium text-white hover:bg-[#006e52]"
          >
            새 업체 등록
          </AdminLink>
        </div>
      ) : (
        <>
          <div className="mb-3 flex justify-end">
            <AdminLink
              href="/owner/places/new"
              className="inline-flex h-9 items-center rounded-lg bg-[#008060] px-3 text-xs font-medium text-white hover:bg-[#006e52]"
            >
              + 새 업체
            </AdminLink>
          </div>
          <ul className="space-y-2">
            {places.map(p => (
              <li key={p.id} className="flex items-center justify-between rounded-lg border border-[#e5e7eb] bg-white p-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-[#222222]">{p.name}</span>
                    <StatusBadge status={p.status} />
                  </div>
                  <p className="mt-0.5 text-xs text-[#6a6a6a]">
                    /{p.city}/{p.category}/{p.slug}
                  </p>
                </div>
                <AdminLink
                  href={`/owner/places/${p.id}`}
                  className="text-xs text-[#4c1d95] underline"
                >
                  편집
                </AdminLink>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    active: { label: '공개', className: 'bg-[#d1fae5] text-[#065f46]' },
    pending: { label: '승인 대기', className: 'bg-[#fef3c7] text-[#92400e]' },
    rejected: { label: '거절됨', className: 'bg-[#fee2e2] text-[#991b1b]' },
  }
  const v = map[status] ?? { label: status, className: 'bg-[#f3f4f6] text-[#484848]' }
  return <span className={`rounded-full px-2 py-0.5 text-[10px] ${v.className}`}>{v.label}</span>
}
