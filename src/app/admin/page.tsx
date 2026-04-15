import Link from 'next/link'
import { requireAuth } from '@/lib/auth'
import { LogoutButton } from './logout-button'

export default async function AdminDashboard() {
  const user = await requireAuth()

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-[#222222]">관리자 대시보드</h1>
        <LogoutButton />
      </div>

      <p className="text-[#6a6a6a] mb-6">
        {user.email}님으로 로그인됨
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link
          href="/admin/places"
          className="block p-6 rounded-xl border border-[#dddddd] bg-white hover:border-[#222222] transition-colors"
        >
          <h2 className="text-lg font-semibold text-[#222222]">업체 목록</h2>
          <p className="text-sm text-[#6a6a6a] mt-1">등록된 업체 관리 · 승인 · 수정 · 삭제</p>
        </Link>
        <Link
          href="/admin/register"
          className="block p-6 rounded-xl border border-[#dddddd] bg-white hover:border-[#222222] transition-colors"
        >
          <h2 className="text-lg font-semibold text-[#222222]">업체 등록</h2>
          <p className="text-sm text-[#6a6a6a] mt-1">새 업체를 등록합니다</p>
        </Link>
      </div>
    </div>
  )
}
