// Sprint D-1 / T-200 — /owner 공통 레이아웃.
// 사이드바 + 반응형 topbar. 로그인 필수 가드는 페이지별 requireOwnerUser 로.
// T-059: Node 전용 모듈(@/lib/supabase/admin-client)을 쓰는 페이지가 있으므로 edge 회피.

import type { ReactNode } from 'react'
import { getOwnerUser } from '@/lib/owner/auth'
import { OwnerSidebar } from './_components/owner-sidebar'
import '@/styles/aip.css'
import '@/styles/owner-dashboard.css'

export const runtime = 'nodejs'

export default async function OwnerLayout({ children }: { children: ReactNode }) {
  const user = await getOwnerUser()

  return (
    <div className="owner-root">
      <div className="owner-shell">
        <OwnerSidebar userEmail={user?.email ?? null} />
        <main className="owner-main">{children}</main>
      </div>
    </div>
  )
}
