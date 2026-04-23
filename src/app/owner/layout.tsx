// /owner 공통 레이아웃. 헤더/사이드바 + 그리드 쉘.
// 로그인 가드는 페이지별 requireOwnerUser 로.

import type { ReactNode } from 'react'
import { getOwnerUser } from '@/lib/owner/auth'
import { OwnerNav } from './_components/owner-nav'
import { OwnerSidebar } from './_components/owner-sidebar'
import { OwnerSidebarProvider } from './_components/owner-sidebar-context'
import '@/styles/aip.css'
import '@/styles/owner-dashboard.css'
import '@/styles/owner-dashboard-remix.css'
import '@/styles/owner-citations-remix.css'
import '@/styles/owner-content-remix.css'
import '@/styles/owner-places-remix.css'
import '@/styles/owner-edit-remix.css'
import '@/styles/owner-place-dashboard-remix.css'
import '@/styles/owner-register-remix.css'
import '@/styles/owner-billing-remix.css'

export const runtime = 'nodejs'

export default async function OwnerLayout({ children }: { children: ReactNode }) {
  const user = await getOwnerUser()
  const email = user?.email ?? null

  return (
    <OwnerSidebarProvider>
      <div className="owner-root">
        <OwnerNav userEmail={email} />
        <div className="dash-layout">
          <OwnerSidebar userEmail={email} />
          <main className="dash-main">{children}</main>
        </div>
      </div>
    </OwnerSidebarProvider>
  )
}
