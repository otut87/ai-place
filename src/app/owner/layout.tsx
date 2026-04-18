import type { ReactNode } from 'react'

// T-059: owner 포털도 Supabase admin-client 등 Node 전용 모듈을 쓰므로 edge 회피.
export const runtime = 'nodejs'

export default function OwnerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f7f7f7]">
      {children}
    </div>
  )
}
