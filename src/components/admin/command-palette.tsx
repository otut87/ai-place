'use client'

// T-083 — 커맨드 팔레트 (⌘K / Ctrl+K).
// cmdk 없이 최소 구현: 라우트 · 최근 본 항목 · 검수 큐 빠른 점프.

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'

interface Command {
  id: string
  label: string
  hint?: string
  href: string
}

const STATIC_COMMANDS: Command[] = [
  { id: 'dashboard', label: '대시보드', hint: 'Ops', href: '/admin' },
  { id: 'review', label: '검수 큐', hint: 'Ops', href: '/admin/review' },
  { id: 'places', label: '업체 목록', hint: 'Content', href: '/admin/places' },
  { id: 'register', label: '새 업체 등록', hint: 'Content', href: '/admin/register' },
  { id: 'blog', label: '블로그 캘린더', hint: 'Content', href: '/admin/blog' },
  { id: 'pipelines', label: '파이프라인', hint: 'Ops', href: '/admin/pipelines' },
  { id: 'seo', label: 'AI 봇 로그', hint: 'SEO', href: '/admin/seo' },
  { id: 'citations', label: 'AI 인용 추적', hint: 'SEO', href: '/admin/citations' },
  { id: 'customers', label: '고객 분석', hint: 'CRM', href: '/admin/customers' },
  { id: 'billing-failures', label: '결제 실패 큐', hint: 'Billing', href: '/admin/billing/failures' },
]

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)
  const router = useRouter()

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isMac = navigator.platform.toUpperCase().includes('MAC')
      const mod = isMac ? e.metaKey : e.ctrlKey
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(v => !v)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (open) inputRef.current?.focus()
    else setQ('')
  }, [open])

  const filtered = filterCommands(STATIC_COMMANDS, q)

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center bg-black/30 pt-24"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-lg rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-[#e7e7e7] px-4 py-3">
          <Search className="h-4 w-4 text-[#6b6b6b]" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="무엇을 찾을까요? (페이지 / 업체명)"
            className="w-full bg-transparent text-sm outline-none"
          />
          <kbd className="rounded border border-[#e7e7e7] bg-[#fafafa] px-1.5 py-0.5 text-[10px] text-[#6b6b6b]">Esc</kbd>
        </div>
        <ul className="max-h-80 overflow-y-auto p-1.5">
          {filtered.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-[#6b6b6b]">결과 없음</li>
          ) : (
            filtered.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-[#f3f4f6]"
                  onClick={() => {
                    setOpen(false)
                    router.push(c.href)
                  }}
                >
                  <span>{c.label}</span>
                  {c.hint && <span className="text-[10px] uppercase text-[#9a9a9a]">{c.hint}</span>}
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  )
}

export function filterCommands(list: Command[], query: string): Command[] {
  const q = query.trim().toLowerCase()
  if (!q) return list
  return list.filter(c =>
    c.label.toLowerCase().includes(q) || c.id.includes(q) || (c.hint?.toLowerCase().includes(q) ?? false),
  )
}
