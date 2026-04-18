'use client'

// T-052 — 다중 후보 큐레이션 UI
// - 3개 description 카드 중 택일
// - 서비스·FAQ·태그는 체크박스로 큐레이션 후 "폼에 반영"

import { useState } from 'react'
import type { CandidatePool } from '@/lib/ai/multi-candidates'

export interface PickerSelection {
  description: string
  services: Array<{ name: string; description?: string; priceRange?: string }>
  faqs: Array<{ question: string; answer: string }>
  tags: string[]
}

export function CandidatePicker({
  pool,
  qualityScores,
  onApply,
  onRegenerate,
  regenerating,
  onCancel,
}: {
  pool: CandidatePool
  qualityScores: number[]
  onApply: (selection: PickerSelection) => void
  onRegenerate: (feedback: string) => void
  regenerating: boolean
  onCancel: () => void
}) {
  const [descIdx, setDescIdx] = useState(0)
  const [svcChecked, setSvcChecked] = useState<boolean[]>(
    pool.services.map((_, i) => i < 5),
  )
  const [faqChecked, setFaqChecked] = useState<boolean[]>(
    pool.faqs.map((_, i) => i < 5),
  )
  const [tagChecked, setTagChecked] = useState<boolean[]>(
    pool.tags.map((_, i) => i < 6),
  )
  const [feedback, setFeedback] = useState('')

  function toggle(setter: React.Dispatch<React.SetStateAction<boolean[]>>, i: number) {
    setter(prev => prev.map((v, idx) => (idx === i ? !v : v)))
  }

  function handleApply() {
    const description = pool.descriptions[descIdx]?.text ?? ''
    onApply({
      description,
      services: pool.services.filter((_, i) => svcChecked[i]),
      faqs: pool.faqs.filter((_, i) => faqChecked[i]),
      tags: pool.tags.filter((_, i) => tagChecked[i]),
    })
  }

  return (
    <div className="space-y-4 rounded-lg border border-[#6366f1]/30 bg-[#f5f3ff] p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#4c1d95]">
          다중 후보 선택 ({pool.descriptions.length}개 description · 품질 스코어 평균 {avg(qualityScores)})
        </h3>
        <button onClick={onCancel} className="text-xs text-[#6a6a6a] underline">취소</button>
      </div>

      {/* description 카드 택일 */}
      <div>
        <p className="mb-2 text-xs font-medium text-[#484848]">1. 설명 (Direct Answer Block)</p>
        <div className="grid gap-2 md:grid-cols-3">
          {pool.descriptions.map((d, i) => (
            <label
              key={i}
              className={`cursor-pointer rounded-md border p-3 text-xs transition ${
                descIdx === i ? 'border-[#6366f1] bg-white shadow-sm' : 'border-[#e5e7eb] bg-white/60'
              }`}
            >
              <div className="mb-1 flex items-center justify-between">
                <input
                  type="radio"
                  checked={descIdx === i}
                  onChange={() => setDescIdx(i)}
                  className="accent-[#6366f1]"
                />
                <span className="text-[10px] text-[#6a6a6a]">
                  {d.score}점 · {d.text.length}자
                </span>
              </div>
              <p className="text-[#222222]">{d.text}</p>
            </label>
          ))}
        </div>
      </div>

      {/* 서비스 체크박스 */}
      <div>
        <p className="mb-2 text-xs font-medium text-[#484848]">
          2. 서비스 ({svcChecked.filter(Boolean).length}/{pool.services.length})
        </p>
        <ul className="space-y-1">
          {pool.services.map((s, i) => (
            <li key={i} className="flex items-start gap-2 text-xs">
              <input
                type="checkbox"
                checked={svcChecked[i] ?? false}
                onChange={() => toggle(setSvcChecked, i)}
                className="mt-0.5 accent-[#6366f1]"
              />
              <span className="flex-1">
                <span className="font-medium text-[#222222]">{s.name}</span>
                {s.priceRange ? <span className="ml-2 text-[#6a6a6a]">{s.priceRange}</span> : null}
                {s.description ? <span className="ml-2 text-[#6a6a6a]">— {s.description}</span> : null}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* FAQ 체크박스 */}
      <div>
        <p className="mb-2 text-xs font-medium text-[#484848]">
          3. FAQ ({faqChecked.filter(Boolean).length}/{pool.faqs.length})
        </p>
        <ul className="space-y-1">
          {pool.faqs.map((f, i) => (
            <li key={i} className="flex items-start gap-2 text-xs">
              <input
                type="checkbox"
                checked={faqChecked[i] ?? false}
                onChange={() => toggle(setFaqChecked, i)}
                className="mt-0.5 accent-[#6366f1]"
              />
              <span className="flex-1">
                <span className="font-medium text-[#222222]">{f.question}</span>
                <span className="block text-[#6a6a6a]">{f.answer}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* 태그 체크박스 */}
      <div>
        <p className="mb-2 text-xs font-medium text-[#484848]">
          4. 태그 ({tagChecked.filter(Boolean).length}/{pool.tags.length})
        </p>
        <div className="flex flex-wrap gap-1">
          {pool.tags.map((t, i) => (
            <label
              key={i}
              className={`cursor-pointer rounded-full border px-2 py-0.5 text-[11px] ${
                tagChecked[i] ? 'border-[#6366f1] bg-white text-[#4c1d95]' : 'border-[#e5e7eb] bg-white/60 text-[#6a6a6a]'
              }`}
            >
              <input
                type="checkbox"
                checked={tagChecked[i] ?? false}
                onChange={() => toggle(setTagChecked, i)}
                className="hidden"
              />
              {t}
            </label>
          ))}
        </div>
      </div>

      {/* Regenerate with feedback */}
      <div className="border-t border-[#6366f1]/20 pt-3">
        <p className="mb-1 text-xs font-medium text-[#484848]">재생성 피드백 (선택)</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={feedback}
            onChange={e => setFeedback(e.target.value)}
            placeholder='예: "좀 더 간결하게", "가격 신호 강조"'
            className="h-9 flex-1 rounded-md border border-[#dddddd] px-3 text-xs"
          />
          <button
            type="button"
            onClick={() => onRegenerate(feedback)}
            disabled={regenerating}
            className="h-9 rounded-md border border-[#6366f1] px-3 text-xs text-[#4c1d95] hover:bg-white disabled:opacity-50"
          >
            {regenerating ? '재생성 중...' : '재생성'}
          </button>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={handleApply}
          className="h-10 rounded-md bg-[#6366f1] px-4 text-sm font-medium text-white hover:bg-[#4f46e5]"
        >
          선택 항목을 폼에 반영
        </button>
      </div>
    </div>
  )
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length)
}
