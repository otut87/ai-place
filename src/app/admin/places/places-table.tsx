'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { bulkUpdateStatus, bulkDeletePlaces } from '@/lib/actions/bulk-places'
import { summarizeBulkResult, type BulkAction } from '@/lib/admin/places-bulk'
import { PlaceActions } from './place-actions'
import { InlineEditField } from './inline-edit-field'
import { ConfirmNameModal } from '@/components/admin/confirm-name-modal'
import { useToast } from '@/components/admin/toast'

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
  // T-065
  quality_score?: number | null
  subscription_status?: string | null
  customer_id?: string | null
}

function SubscriptionPill({ status }: { status: string | null | undefined }) {
  if (!status) return <span className="text-xs text-[#9a9a9a]">—</span>
  const map: Record<string, { label: string; cls: string }> = {
    active:    { label: '결제 중',  cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    past_due:  { label: '연체',     cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    suspended: { label: '중단',     cls: 'bg-red-50 text-red-700 border-red-200' },
    canceled:  { label: '해지',     cls: 'bg-[#f3f4f6] text-[#6b6b6b] border-[#e7e7e7]' },
    pending:   { label: '결제 대기', cls: 'bg-[#f3f4f6] text-[#6b6b6b] border-[#e7e7e7]' },
  }
  const { label, cls } = map[status] ?? { label: status, cls: 'bg-[#f3f4f6] text-[#6b6b6b] border-[#e7e7e7]' }
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] ${cls}`}>{label}</span>
}

function QualityPill({ score }: { score: number | null | undefined }) {
  if (score == null) return <span className="text-xs text-[#9a9a9a]">—</span>
  const tone = score >= 80 ? 'text-emerald-700' : score >= 60 ? 'text-amber-700' : 'text-red-700'
  return <span className={`text-xs font-medium ${tone}`}>{score}점</span>
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

const BULK_DELETE_CONFIRM_TOKEN = 'DELETE'

export function PlacesTable({ places }: { places: TableRow[] }) {
  const router = useRouter()
  const toast = useToast()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [working, setWorking] = useState(false)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)

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
    const ids = Array.from(selected)
    if (ids.length === 0) return

    if (action === 'delete') {
      // 삭제는 ConfirmNameModal 에서 "DELETE" 타이핑 일치 후에만 진행.
      setConfirmDeleteOpen(true)
      return
    }

    await executeBulk(action, ids)
  }

  async function executeBulk(action: BulkAction, ids: string[]) {
    setWorking(true)
    try {
      const result =
        action === 'delete' ? await bulkDeletePlaces(ids) : await bulkUpdateStatus(ids, action)

      if (!result.success) {
        toast.error(result.error ?? '처리 실패')
      } else {
        const processed = result.processed ?? ids.length
        toast.success(summarizeBulkResult({ successes: processed, failures: ids.length - processed }))
        setSelected(new Set())
      }
    } catch (e) {
      toast.error(String((e as Error)?.message ?? e))
    }
    setWorking(false)
    router.refresh()
  }

  async function confirmBulkDelete() {
    setConfirmDeleteOpen(false)
    await executeBulk('delete', Array.from(selected))
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

      <ConfirmNameModal
        open={confirmDeleteOpen}
        expectedName={BULK_DELETE_CONFIRM_TOKEN}
        title={`${selectedCount}개 업체 일괄 삭제`}
        description={`선택된 ${selectedCount}개 업체를 영구 삭제합니다. 되돌릴 수 없습니다.`}
        onCancel={() => setConfirmDeleteOpen(false)}
        onConfirm={confirmBulkDelete}
      />

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
                <QualityPill score={place.quality_score} />
                <SubscriptionPill status={place.subscription_status} />
                <StatusPill status={place.status} />
                <PlaceActions placeId={place.id} placeName={place.name} status={place.status} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
