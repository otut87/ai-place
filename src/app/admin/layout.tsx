import type { ReactNode } from 'react'
import { Sidebar } from '@/components/admin/sidebar'
import { Topbar } from '@/components/admin/topbar'
import { AdminShellClient } from '@/components/admin/admin-shell-client'
import { CommandPalette } from '@/components/admin/command-palette'
import { getUser } from '@/lib/auth'

// T-059: admin 은 Supabase admin-client 등 Node 전용 모듈을 사용하므로
// edge 회피. 이 선언으로 하위 라우트도 기본 runtime = nodejs 상속.
export const runtime = 'nodejs'

// T-061: 공용 섀시 — 좌측 사이드바 + 상단 글로벌 바. 본문은 풀폭.
// /admin/login 은 미들웨어·layout 로직 상 로그인 성공 전에도 렌더되어야 하므로
// getUser() 가 null 일 수 있음 → topbar 의 email 은 optional 로 처리.
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getUser()

  // 비로그인 상태(주로 /admin/login) 에서는 섀시 숨김 — 로그인 페이지는 풀 스크린.
  if (!user) {
    return <div className="min-h-screen bg-[#f7f7f7]">{children}</div>
  }

  return (
    <AdminShellClient>
      <div className="flex min-h-screen bg-[#f7f7f7]">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar userEmail={user.email ?? null} />
          <main className="flex-1">{children}</main>
        </div>
      </div>
      <CommandPalette />
    </AdminShellClient>
  )
}
