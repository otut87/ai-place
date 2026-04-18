'use client'

import type { ReactNode } from 'react'
import { ToastProvider } from './toast'

// T-063 — admin layout 의 클라이언트 전용 래퍼.
// ToastProvider 를 layout.tsx(server) 에서 바로 쓸 수 없으므로 경유.
export function AdminShellClient({ children }: { children: ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>
}
