// T-201 — /owner 공통 레이아웃 (docs/AIPLACE/dashboard.html 구조).
//   nav.top (상단) + dash-layout (side-nav 240px + main 1fr)
// 로그인 가드는 페이지별 requireOwnerUser 로.

import type { ReactNode } from 'react'
import { getOwnerUser } from '@/lib/owner/auth'
import { OwnerNav } from './_components/owner-nav'
import { OwnerSidebar } from './_components/owner-sidebar'
import '@/styles/aip.css'
import '@/styles/owner-dashboard.css'

export const runtime = 'nodejs'

export default async function OwnerLayout({ children }: { children: ReactNode }) {
  const user = await getOwnerUser()
  const email = user?.email ?? null

  return (
    <div className="owner-root">
      <OwnerNav userEmail={email} />
      <div className="dash-layout">
        <OwnerSidebar userEmail={email} />
        <main className="dash-main">{children}</main>
      </div>
    </div>
  )
}
