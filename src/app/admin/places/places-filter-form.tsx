'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, type FormEvent } from 'react'

export interface FilterOption {
  value: string
  label: string
}

interface Props {
  cities: FilterOption[]
  sectors: FilterOption[]
  categories: Array<FilterOption & { sector: string }>
}

const STATUS_OPTIONS: FilterOption[] = [
  { value: 'all', label: '전체 상태' },
  { value: 'active', label: 'active' },
  { value: 'pending', label: 'pending' },
  { value: 'rejected', label: 'rejected' },
]

export function PlacesFilterForm({ cities, sectors, categories }: Props) {
  const router = useRouter()
  const sp = useSearchParams()

  const [q, setQ] = useState(sp.get('q') ?? '')
  const [city, setCity] = useState(sp.get('city') ?? 'all')
  const [sector, setSector] = useState(sp.get('sector') ?? 'all')
  const [category, setCategory] = useState(sp.get('category') ?? 'all')
  const [status, setStatus] = useState(sp.get('status') ?? 'all')
  // T-065
  const [subscription, setSubscription] = useState(sp.get('subscription') ?? 'all')
  const [minQualityScore, setMinQualityScore] = useState(sp.get('min_quality_score') ?? '')

  const filteredCategories =
    sector === 'all' ? categories : categories.filter((c) => c.sector === sector)

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const params = new URLSearchParams()
    if (q.trim()) params.set('q', q.trim())
    if (city !== 'all') params.set('city', city)
    if (sector !== 'all') params.set('sector', sector)
    if (category !== 'all') params.set('category', category)
    if (status !== 'all') params.set('status', status)
    if (subscription !== 'all') params.set('subscription', subscription)
    const mq = Number.parseInt(minQualityScore, 10)
    if (Number.isFinite(mq) && mq > 0) params.set('min_quality_score', String(mq))
    router.push(`/admin/places${params.toString() ? `?${params}` : ''}`)
  }

  function reset() {
    setQ('')
    setCity('all')
    setSector('all')
    setCategory('all')
    setStatus('all')
    setSubscription('all')
    setMinQualityScore('')
    router.push('/admin/places')
  }

  const selectCls =
    'h-10 px-3 rounded-lg border border-[#dddddd] bg-white text-sm text-[#222222] focus:outline-none focus:border-[#222222]'

  return (
    <form onSubmit={submit} className="mb-6 flex flex-wrap items-center gap-2">
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="업체명 검색"
        aria-label="업체명 검색"
        className="h-10 px-3 w-60 rounded-lg border border-[#dddddd] bg-white text-sm focus:outline-none focus:border-[#222222]"
      />

      <select value={city} onChange={(e) => setCity(e.target.value)} className={selectCls} aria-label="도시">
        <option value="all">전체 도시</option>
        {cities.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>

      <select
        value={sector}
        onChange={(e) => {
          setSector(e.target.value)
          setCategory('all')
        }}
        className={selectCls}
        aria-label="섹터"
      >
        <option value="all">전체 섹터</option>
        {sectors.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>

      <select
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        className={selectCls}
        aria-label="업종"
      >
        <option value="all">전체 업종</option>
        {filteredCategories.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>

      <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectCls} aria-label="상태">
        {STATUS_OPTIONS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>

      <select
        value={subscription}
        onChange={(e) => setSubscription(e.target.value)}
        className={selectCls}
        aria-label="구독 상태"
      >
        <option value="all">전체 구독</option>
        <option value="paid">결제 중</option>
        <option value="past_due">연체</option>
        <option value="suspended">일시 중단</option>
      </select>

      <input
        type="number"
        min={0}
        max={100}
        value={minQualityScore}
        onChange={(e) => setMinQualityScore(e.target.value)}
        placeholder="최소 품질 점수"
        aria-label="최소 품질 점수"
        className="h-10 w-32 rounded-lg border border-[#dddddd] bg-white px-3 text-sm focus:outline-none focus:border-[#222222]"
      />

      <button type="submit" className="h-10 px-4 rounded-lg bg-[#222222] text-white text-sm font-medium">
        적용
      </button>
      <button type="button" onClick={reset} className="h-10 px-4 rounded-lg border border-[#dddddd] bg-white text-sm">
        초기화
      </button>
    </form>
  )
}
