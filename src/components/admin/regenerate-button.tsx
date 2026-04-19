'use client'

// T-075 — 공통 재생성 버튼. 필드 옆에 드랍다운 옵션과 함께 배치.

import { useState, useTransition } from 'react'
import { RefreshCw, ChevronDown } from 'lucide-react'
import {
  regenerateField,
  type RegenerateField,
  type RegenerateResult,
} from '@/lib/actions/regenerate-field'
import { useToast } from './toast'

interface Props {
  placeId: string
  field: RegenerateField
  onResult: (result: RegenerateResult) => void
  disabled?: boolean
}

export function RegenerateButton({ placeId, field, onResult, disabled }: Props) {
  const [pending, start] = useTransition()
  const [open, setOpen] = useState(false)
  const [tone, setTone] = useState('')
  const [length, setLength] = useState<'short' | 'medium' | 'long'>('medium')
  const [keywordsRaw, setKeywordsRaw] = useState('')
  const toast = useToast()

  function run() {
    setOpen(false)
    start(async () => {
      const keywords = keywordsRaw.split(',').map(s => s.trim()).filter(Boolean)
      const r = await regenerateField({
        placeId,
        field,
        tone: tone.trim() || undefined,
        length,
        keywords: keywords.length > 0 ? keywords : undefined,
      })
      if (r.success) {
        toast.success('재생성 완료')
        onResult(r)
      } else {
        toast.error(r.error ?? '재생성 실패')
      }
    })
  }

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        disabled={disabled || pending}
        onClick={() => start(async () => run())}
        className="inline-flex items-center gap-1 rounded-md border border-[#e7e7e7] bg-white px-2 py-1 text-[11px] text-[#6b6b6b] transition-colors hover:border-[#d1d1d1] hover:bg-[#fafafa] disabled:cursor-not-allowed disabled:opacity-50"
        aria-label={`${field} 재생성`}
      >
        <RefreshCw className={`h-3 w-3 ${pending ? 'animate-spin' : ''}`} />
        재생성
      </button>
      <button
        type="button"
        disabled={disabled || pending}
        onClick={() => setOpen(v => !v)}
        className="ml-0.5 inline-flex h-6 w-6 items-center justify-center rounded-md border border-[#e7e7e7] bg-white text-[#6b6b6b] hover:border-[#d1d1d1] hover:bg-[#fafafa] disabled:opacity-50"
        aria-label="재생성 옵션"
      >
        <ChevronDown className="h-3 w-3" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-64 rounded-lg border border-[#e7e7e7] bg-white p-3 shadow-lg">
          {field === 'description' && (
            <label className="mb-2 block text-xs text-[#6b6b6b]">
              길이
              <select
                value={length}
                onChange={(e) => setLength(e.target.value as 'short' | 'medium' | 'long')}
                className="mt-1 block h-8 w-full rounded-md border border-[#e7e7e7] bg-white px-2 text-xs"
              >
                <option value="short">짧게 (2~3문장)</option>
                <option value="medium">보통</option>
                <option value="long">길게 (5문장+)</option>
              </select>
            </label>
          )}
          <label className="mb-2 block text-xs text-[#6b6b6b]">
            어조
            <input
              type="text"
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              placeholder="예: 간결하게, 전문 용어 강조"
              className="mt-1 block h-8 w-full rounded-md border border-[#e7e7e7] bg-white px-2 text-xs"
            />
          </label>
          <label className="mb-3 block text-xs text-[#6b6b6b]">
            강조 키워드 (쉼표 구분)
            <input
              type="text"
              value={keywordsRaw}
              onChange={(e) => setKeywordsRaw(e.target.value)}
              placeholder="예: 여드름, 리프팅"
              className="mt-1 block h-8 w-full rounded-md border border-[#e7e7e7] bg-white px-2 text-xs"
            />
          </label>
          <div className="flex justify-end gap-1.5">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md px-2.5 py-1 text-xs text-[#6b6b6b] hover:bg-[#f3f4f6]"
            >
              취소
            </button>
            <button
              type="button"
              onClick={run}
              className="rounded-md bg-[#191919] px-2.5 py-1 text-xs text-white hover:bg-[#333]"
            >
              옵션 적용
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
