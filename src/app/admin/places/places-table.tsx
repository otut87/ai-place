'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { bulkUpdateStatus, bulkDeletePlaces } from '@/lib/actions/bulk-places'
import { summarizeBulkResult, type BulkAction } from '@/lib/admin/places-bulk'
import { PlaceActions } from './place-actions'
import { InlineEditField } from './inline-edit-field'

export interface TableRow {
  id: string
  slug: string
  name: string
  city: string
  category: string
  status: string
  rating: number | null
  review_count: number | null
  phone: string | null
  tags: string[] | null
  created_at: string
}

function StatusPill({ status }: { status: string }) {
  const cls =
    status === 'active'
      ? 'bg-green-100 text-green-700'
      : status === 'pending'
      ? 'bg-yellow-100 text-yellow-700'
      : 'bg-red-100 text-red-700'
  return <span className={`text-xs px-2 py-1 rounded-full ${cls}`}>{status}</span>
}

export function PlacesTable({ places }: { places: TableRow[] }) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [working, setWorking] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const allIds = useMemo(() => places.map((p) => p.id), [places])
  const allChecked = allIds.length > 0 && allIds.every((id) => selected.has(id))
  const someChecked = !allChecked && allIds.some((id) => selected.has(id))

  function toggle(id: string) {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  function toggleAll() {
    if (allChecked) setSelected(new Set())
    else setSelected(new Set(allIds))
  }

  async function runBulk(action: BulkAction) {
    setError(null)
    setMessage(null)
    const ids = Array.from(selected)
    if (ids.length === 0) return

    if (action === 'delete') {
      if (!confirm(`선택한 ${ids.length}개 업체를 삭제하시겠습니까? 되돌릴 수 없습니다.`)) return
    }

    setWorking(true)
    try {
      const result =
        action === 'delete' ? await bulkDeletePlaces(ids) : await bulkUpdateStatus(ids, action)

      if (!result.success) {
        setError(result.error ?? '처리 실패')
      } else {
        const processed = result.processed ?? ids.length
        setMessage(summarizeBulkResult({ successes: processed, failures: ids.length - processed }))
        setSelected(new Set())
      }
    } catch (e) {
      setError(String((e as Error)?.message ?? e))
    }
    setWorking(false)
    router.refresh()
  }

  const selectedCount = selected.size
  const disabled = working || selectedCount === 0

  const bulkBtn =
    'h-9 px-3 rounded-lg text-xs font-medium disabled:opacity-40 disabled:pointer-events-none'

  return (
    <div>
      <div className="mb-3 flex items-center justify-between rounded-lg border border-[#dddddd] bg-white px-4 py-2">
        <label className="flex items-center gap-2 text-sm text-[#222222] cursor-pointer">
          <input
            type="checkbox"
            checked={allChecked}
            ref={(el) => {
              if (el) el.indeterminate = someChecked
            }}
            onChange={toggleAll}
            aria-label="전체 선택"
          />
          {selectedCount > 0 ? `${selectedCount}개 선택` : '전체 선택'}
        </label>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => runBulk('activate')}
            className={`${bulkBtn} bg-green-600 text-white hover:bg-green-700`}
          >
            일괄 승인
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => runBulk('reject')}
            className={`${bulkBtn} bg-yellow-100 text-yellow-700 hover:bg-yellow-200`}
          >
            일괄 반려
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => runBulk('delete')}
            className={`${bulkBtn} border border-red-200 bg-white text-red-600 hover:bg-red-50`}
          >
            일괄 삭제
          </button>
        </div>
      </div>

      {message && <p className="mb-3 text-sm text-green-700">{message}</p>}
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <div className="space-y-3">
        {places.map((place) => {
          const checked = selected.has(place.id)
          return (
            <div
              key={place.id}
              className={`flex items-center justify-between p-4 rounded-xl border bg-white transition-colors ${
                checked ? 'border-[#222222]' : 'border-[#dddddd]'
              }`}
            >
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(place.id)}
                  aria-label={`${place.name} 선택`}
                />
                <div className="min-w-0">
                  <div className="font-medium text-[#222222]">
                    <InlineEditField placeId={place.id} field="name" initialValue={place.name} />
                  </div>
                  <div className="text-sm text-[#6a6a6a] flex items-center gap-2 flex-wrap">
                    <span>
                      {place.city} · {place.category}
                      {place.rating != null && ` · ★ ${place.rating}`}
                    </span>
                    <span className="text-[#cccccc]">·</span>
                    <InlineEditField
                      placeId={place.id}
                      field="phone"
                      initialValue={place.phone ?? ''}
                      placeholder="전화번호"
                      className="text-sm"
                    />
                    <span className="text-[#cccccc]">·</span>
                    <InlineEditField
                      placeId={place.id}
                      field="tags"
                      initialValue={(place.tags ?? []).join(', ')}
                      placeholder="태그"
                      className="text-sm"
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <StatusPill status={place.status} />
                <PlaceActions placeId={place.id} status={place.status} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
