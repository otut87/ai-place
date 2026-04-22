'use client'

// OwnerNav(헤더) 와 OwnerSidebar(사이드바) 간 drawer open/close 공유 컨텍스트.
// 모바일 햄버거는 헤더 하나에만 두고 사이드바는 상태만 구독.

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

interface OwnerSidebarCtx {
  isOpen: boolean
  open: () => void
  close: () => void
  toggle: () => void
}

const Ctx = createContext<OwnerSidebarCtx | null>(null)

export function OwnerSidebarProvider({ children }: { children: ReactNode }) {
  const [isOpen, setOpen] = useState(false)
  const open = useCallback(() => setOpen(true), [])
  const close = useCallback(() => setOpen(false), [])
  const toggle = useCallback(() => setOpen((v) => !v), [])

  const value = useMemo<OwnerSidebarCtx>(() => ({ isOpen, open, close, toggle }), [isOpen, open, close, toggle])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useOwnerSidebar(): OwnerSidebarCtx {
  const v = useContext(Ctx)
  if (!v) {
    // provider 없이 렌더될 수 있는 페이지(로그인 등) 대비 no-op.
    return { isOpen: false, open: () => {}, close: () => {}, toggle: () => {} }
  }
  return v
}
