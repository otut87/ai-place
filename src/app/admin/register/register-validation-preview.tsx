'use client'

import type { DraftValidation, PlaceDraft } from '@/lib/admin/place-validation'

interface Props {
  draft: PlaceDraft
  validation: DraftValidation
  categoryName?: string
  cityName?: string
}

const FIELD_LABELS: Record<string, string> = {
  name: '업체명',
  city: '도시',
  category: '업종',
  slug: '슬러그',
  description: '소개',
  address: '주소',
  phone: '전화번호',
  faqs: 'FAQ',
}

export function RegisterValidationPreview({ draft, validation, categoryName, cityName }: Props) {
  const { errors, warnings, completeness } = validation
  const errorEntries = Object.entries(errors)

  return (
    <div className="mt-8 rounded-xl border border-[#dddddd] bg-[#fafafa] p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-[#222222]">실시간 검증 · 미리보기</h3>
        <span className="text-xs text-[#6a6a6a]">완성도 {completeness}%</span>
      </div>

      <div className="h-1.5 w-full bg-[#eeeeee] rounded-full overflow-hidden mb-5">
        <div
          className={`h-full transition-all ${
            completeness >= 80 ? 'bg-green-500' : completeness >= 50 ? 'bg-yellow-500' : 'bg-red-500'
          }`}
          style={{ width: `${completeness}%` }}
        />
      </div>

      {errorEntries.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-medium text-red-700 mb-1">필수 항목</p>
          <ul className="space-y-0.5">
            {errorEntries.map(([field, msg]) => (
              <li key={field} className="text-xs text-red-600">
                · <strong>{FIELD_LABELS[field] ?? field}</strong> {msg}
              </li>
            ))}
          </ul>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-medium text-yellow-700 mb-1">권장</p>
          <ul className="space-y-0.5">
            {warnings.map((w, i) => (
              <li key={i} className="text-xs text-yellow-700">
                · {w}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-lg border border-[#dddddd] bg-white p-4">
        <p className="text-xs text-[#8a8a8a] mb-1">프리뷰</p>
        <p className="font-medium text-[#222222]">{draft.name || '(업체명)'}</p>
        <p className="text-sm text-[#6a6a6a]">
          {cityName || draft.city || '(도시)'} · {categoryName || draft.category || '(업종)'}
        </p>
        {draft.address && <p className="text-xs text-[#6a6a6a] mt-1">{draft.address}</p>}
        {draft.phone && <p className="text-xs text-[#6a6a6a]">{draft.phone}</p>}
        {draft.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {draft.tags.slice(0, 6).map((t) => (
              <span key={t} className="text-xs px-2 py-0.5 rounded-full border border-[#dddddd] text-[#484848]">
                #{t}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
