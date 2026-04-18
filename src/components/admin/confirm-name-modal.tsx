'use client'

// T-063 — 파괴적 액션용 이름 입력 확인 모달.
// 업체명·항목명을 정확히 타이핑해야 버튼 활성화. window.confirm 대체.

import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export interface ConfirmNameModalProps {
  open: boolean
  expectedName: string
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmNameModal({
  open,
  expectedName,
  title,
  description,
  confirmLabel = '삭제',
  cancelLabel = '취소',
  danger = true,
  onConfirm,
  onCancel,
}: ConfirmNameModalProps) {
  const [typed, setTyped] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const titleId = useId()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (open) {
      setTyped('')
      // 모달 오픈 직후 포커스
      queueMicrotask(() => inputRef.current?.focus())
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open || !mounted || typeof document === 'undefined') return null

  const matches = typed.trim() === expectedName

  const modal = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-lg border border-[#e5e7eb] bg-white p-5 shadow-lg"
        onClick={e => e.stopPropagation()}
      >
        <h2 id={titleId} className="text-base font-semibold text-[#222222]">{title}</h2>
        {description && <p className="mt-1 text-sm text-[#6a6a6a]">{description}</p>}
        <p className="mt-3 text-xs text-[#484848]">
          계속하려면 <code className="rounded bg-[#f3f4f6] px-1 py-0.5 text-[#991b1b]">{expectedName}</code> 을(를) 정확히 입력하세요.
        </p>
        <input
          ref={inputRef}
          type="text"
          value={typed}
          onChange={e => setTyped(e.target.value)}
          className="mt-2 w-full rounded-md border border-[#dddddd] px-3 py-2 text-sm"
          aria-label={`${expectedName} 입력`}
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-9 rounded-md border border-[#dddddd] bg-white px-3 text-sm text-[#484848] hover:bg-[#f3f4f6]"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={!matches}
            onClick={onConfirm}
            className={`h-9 rounded-md px-3 text-sm text-white disabled:opacity-40 ${
              danger ? 'bg-[#dc2626] hover:bg-[#b91c1c]' : 'bg-[#222222] hover:opacity-90'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
