'use client'

// T-063 — 어드민 공용 토스트.
// 외부 라이브러리 없이 Context + Portal 없이 fixed 영역만. 자동 해제 3.5초.

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { CheckCircle2, XCircle, Info } from 'lucide-react'

export type ToastTone = 'success' | 'error' | 'info'
export interface ToastItem {
  id: string
  tone: ToastTone
  message: string
}

interface ToastContextValue {
  push: (tone: ToastTone, message: string) => void
  success: (message: string) => void
  error: (message: string) => void
  info: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}

const DURATION_MS = 3500

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const push = useCallback((tone: ToastTone, message: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    setItems(prev => [...prev, { id, tone, message }])
    setTimeout(() => {
      setItems(prev => prev.filter(t => t.id !== id))
    }, DURATION_MS)
  }, [])

  const value: ToastContextValue = {
    push,
    success: (m) => push('success', m),
    error: (m) => push('error', m),
    info: (m) => push('info', m),
  }

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2" aria-live="polite">
        {items.map(t => (
          <ToastCard key={t.id} item={t} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastCard({ item }: { item: ToastItem }) {
  const Icon = item.tone === 'success' ? CheckCircle2 : item.tone === 'error' ? XCircle : Info
  const tone =
    item.tone === 'success'
      ? 'border-[#86efac] bg-[#f0fdf4] text-[#065f46]'
      : item.tone === 'error'
        ? 'border-[#fca5a5] bg-[#fef2f2] text-[#991b1b]'
        : 'border-[#c4b5fd] bg-[#f5f3ff] text-[#4c1d95]'
  return (
    <div
      role="status"
      className={`pointer-events-auto flex max-w-sm items-start gap-2 rounded-md border px-3 py-2 text-sm shadow-sm ${tone}`}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{item.message}</span>
    </div>
  )
}
