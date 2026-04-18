'use client'

import { useState, useRef, useEffect, type KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import { updatePlaceInlineField } from '@/lib/actions/inline-edit-place'
import type { InlineField } from '@/lib/admin/inline-edit'

interface Props {
  placeId: string
  field: InlineField
  initialValue: string
  placeholder?: string
  className?: string
}

export function InlineEditField({ placeId, field, initialValue, placeholder, className }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(initialValue)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  async function save() {
    if (saving) return
    if (value === initialValue) {
      setEditing(false)
      return
    }
    setSaving(true)
    setError(null)
    const result = await updatePlaceInlineField(placeId, field, value)
    setSaving(false)
    if (!result.success) {
      setError(result.error ?? '저장 실패')
      return
    }
    setEditing(false)
    router.refresh()
  }

  function cancel() {
    setValue(initialValue)
    setError(null)
    setEditing(false)
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') save()
    else if (e.key === 'Escape') cancel()
  }

  if (!editing) {
    const display = initialValue || placeholder || '—'
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className={`text-left hover:bg-[#f7f7f7] px-1 -mx-1 rounded ${!initialValue ? 'text-[#6a6a6a] italic' : ''} ${className ?? ''}`}
        aria-label={`${field} 편집`}
      >
        {display}
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="text"
        value={value}
        disabled={saving}
        placeholder={placeholder}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={save}
        className="h-8 px-2 rounded border border-[#222222] bg-white text-sm"
      />
      {saving && <span className="text-xs text-[#6a6a6a]">저장 중...</span>}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  )
}
