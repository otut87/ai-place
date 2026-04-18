import type { ReactNode } from 'react'

// T-059: admin 은 Supabase admin-client 등 Node 전용 모듈을 사용하므로
// edge 회피. 이 선언으로 하위 라우트도 기본 runtime = nodejs 상속.
export const runtime = 'nodejs'

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f7f7f7]">
      {children}
    </div>
  )
}
