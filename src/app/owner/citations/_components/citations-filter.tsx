'use client'

// /owner/citations 필터 — 기간(30/90) + 업체 dropdown. 변경 즉시 searchParams 갱신.

import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'

interface PlaceOption {
  id: string
  name: string
}

interface Props {
  places: PlaceOption[]
  days: number
  placeId: string | null
}

export function CitationsFilter({ places, days, placeId }: Props) {
  const router = useRouter()
  const params = useSearchParams()
  const [pending, startTransition] = useTransition()

  function patch(next: Record<string, string | null>) {
    const sp = new URLSearchParams(params?.toString() ?? '')
    for (const [k, v] of Object.entries(next)) {
      if (v === null || v === '') sp.delete(k)
      else sp.set(k, v)
    }
    startTransition(() => router.replace(`/owner/citations${sp.toString() ? `?${sp}` : ''}`))
  }

  return (
    <div className="citations-filter" data-pending={pending ? 'true' : undefined}>
      <label>
        <span>기간</span>
        <select value={days} onChange={(e) => patch({ days: e.target.value })}>
          <option value="30">최근 30일</option>
          <option value="90">최근 90일</option>
        </select>
      </label>

      <label>
        <span>업체</span>
        <select
          value={placeId ?? ''}
          onChange={(e) => patch({ place: e.target.value || null })}
        >
          <option value="">전체 업체</option>
          {places.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </label>
    </div>
  )
}
