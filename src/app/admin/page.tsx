import { AdminLink } from '@/components/admin/admin-link'
import { requireAuth } from '@/lib/auth'

// T-061 이후 layout 에서 Sidebar + Topbar 제공. 본문은 요약 액션 카드만.
// T-064 에서 운영 대시보드로 교체 예정.
export default async function AdminDashboard() {
  await requireAuth()

  return (
    <div className="mx-auto w-full max-w-5xl p-6">
      <h1 className="mb-1 text-xl font-semibold text-[#222222]">대시보드</h1>
      <p className="mb-6 text-sm text-[#6a6a6a]">T-064 에서 운영 지표 카드 추가 예정.</p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <AdminLink
          href="/admin/places"
          className="block rounded-xl border border-[#dddddd] bg-white p-6 transition-colors hover:border-[#222222]"
        >
          <h2 className="text-lg font-semibold text-[#222222]">업체 목록</h2>
          <p className="mt-1 text-sm text-[#6a6a6a]">등록된 업체 관리 · 승인 · 수정 · 삭제</p>
        </AdminLink>
        <AdminLink
          href="/admin/register"
          className="block rounded-xl border border-[#dddddd] bg-white p-6 transition-colors hover:border-[#222222]"
        >
          <h2 className="text-lg font-semibold text-[#222222]">업체 등록</h2>
          <p className="mt-1 text-sm text-[#6a6a6a]">새 업체를 등록합니다</p>
        </AdminLink>
      </div>
    </div>
  )
}
