'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { approvePlace, rejectPlace } from '@/lib/actions/review-place'
import { REJECT_REASONS, rejectReasonLabel, type RejectReason } from '@/lib/admin/review-queue'
import { useToast } from '@/components/admin/toast'

export interface PendingPlace {
  id: string
  slug: string
  name: string
  city: string
  category: string
  description: string | null
  services: Array<{ name: string; description?: string; priceRange?: string }> | null
  faqs: Array<{ question: string; answer: string }> | null
  tags: string[] | null
  phone: string | null
  rating: number | null
  review_count: number | null
  created_at: string
}

interface Props {
  pending: PendingPlace[]
  initialPlaceId: string | null
}

export function ReviewQueueClient({ pending, initialPlaceId }: Props) {
  const router = useRouter()
  const toast = useToast()
  const [busy, startTransition] = useTransition()
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const initialIdx = Math.max(0, pending.findIndex(p => p.id === initialPlaceId))
  const [idx, setIdx] = useState(pending.length > 0 ? initialIdx : -1)

  const current = idx >= 0 ? pending[idx] : null

  const moveNext = useCallback(() => {
    setIdx(prev => Math.min(pending.length - 1, prev + 1))
  }, [pending.length])

  const movePrev = useCallback(() => {
    setIdx(prev => Math.max(0, prev - 1))
  }, [])

  const handleApprove = useCallback(() => {
    if (!current) return
    startTransition(async () => {
      const r = await approvePlace(current.id)
      if (r.success) {
        toast.success(`${current.name} 승인됨`)
        router.refresh()
        moveNext()
      } else {
        toast.error(r.error ?? '승인 실패')
      }
    })
  }, [current, router, toast, moveNext])

  const handleReject = useCallback((reason: RejectReason, note?: string) => {
    if (!current) return
    startTransition(async () => {
      const r = await rejectPlace({ placeId: current.id, reason, note })
      if (r.success) {
        toast.success(`${current.name} 반려됨 (${rejectReasonLabel(reason)})`)
        router.refresh()
        moveNext()
      } else {
        toast.error(r.error ?? '반려 실패')
      }
    })
    setRejectingId(null)
  }, [current, router, toast, moveNext])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (busy || !current) return
      // 입력 중이면 단축키 무시
      const target = e.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return

      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        handleApprove()
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'Backspace') {
        e.preventDefault()
        setRejectingId(current.id)
      } else if (e.key === 'j' || e.key === 'J') {
        moveNext()
      } else if (e.key === 'k' || e.key === 'K') {
        movePrev()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, current, handleApprove, moveNext, movePrev])

  if (pending.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-sm text-[#6a6a6a]">
        검수 대기 중인 업체가 없습니다. 🎉
      </div>
    )
  }

  return (
    <>
      <aside className="w-72 shrink-0 overflow-y-auto border-r border-[#e5e7eb] bg-white">
        <header className="sticky top-0 z-10 border-b border-[#e5e7eb] bg-white px-3 py-2">
          <h2 className="text-sm font-semibold text-[#222222]">검수 큐</h2>
          <p className="text-xs text-[#6a6a6a]">{pending.length}건 · ⌘↵ 승인 · ⌘⌫ 반려 · J/K 이동</p>
        </header>
        <ul className="divide-y divide-[#f3f4f6]">
          {pending.map((p, i) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => setIdx(i)}
                className={`block w-full px-3 py-2 text-left text-xs transition-colors ${
                  i === idx ? 'bg-[#f5f3ff]' : 'hover:bg-[#f9fafb]'
                }`}
              >
                <div className="font-medium text-[#222222]">{p.name}</div>
                <div className="mt-0.5 text-[#6a6a6a]">{p.city} · {p.category}</div>
                <div className="text-[10px] text-[#9ca3af]">
                  {new Date(p.created_at).toLocaleString('ko-KR')}
                </div>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <section className="flex-1 overflow-y-auto">
        {current ? (
          <div className="grid h-full grid-cols-1 lg:grid-cols-2">
            <div className="overflow-y-auto border-r border-[#e5e7eb] bg-[#fafafa] p-4">
              <h3 className="mb-2 text-xs font-semibold uppercase text-[#6a6a6a]">AI 원본</h3>
              <PlaceContent place={current} />
            </div>
            <div className="flex flex-col overflow-y-auto p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xs font-semibold uppercase text-[#6a6a6a]">검수 결정</h3>
                  <h1 className="mt-1 text-lg font-semibold text-[#222222]">{current.name}</h1>
                  <p className="text-xs text-[#6a6a6a]">/{current.city}/{current.category}/{current.slug}</p>
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleApprove}
                  className="h-10 rounded-md bg-[#00a67c] px-4 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                >
                  ⌘↵ 승인
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setRejectingId(current.id)}
                  className="h-10 rounded-md bg-[#dc2626] px-4 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                >
                  ⌘⌫ 반려
                </button>
                <button
                  type="button"
                  disabled={idx <= 0}
                  onClick={movePrev}
                  className="h-10 rounded-md border border-[#dddddd] bg-white px-3 text-sm text-[#484848] hover:bg-[#f3f4f6] disabled:opacity-40"
                >
                  K 이전
                </button>
                <button
                  type="button"
                  disabled={idx >= pending.length - 1}
                  onClick={moveNext}
                  className="h-10 rounded-md border border-[#dddddd] bg-white px-3 text-sm text-[#484848] hover:bg-[#f3f4f6] disabled:opacity-40"
                >
                  J 다음
                </button>
              </div>

              {rejectingId === current.id && (
                <RejectPanel
                  onSubmit={handleReject}
                  onCancel={() => setRejectingId(null)}
                />
              )}

              <div className="mt-6 rounded-md border border-[#e5e7eb] bg-white p-3">
                <h4 className="mb-2 text-xs font-semibold uppercase text-[#6a6a6a]">편집 가능 사본</h4>
                <p className="text-xs text-[#6a6a6a]">
                  최종본은 <a href={`/admin/places/${current.id}/edit`} className="text-[#00a67c] underline">편집 페이지</a>에서 수정 후 승인하세요 (T-066 에서 탭 UI 통합 예정).
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-[#6a6a6a]">
            좌측에서 항목을 선택하세요.
          </div>
        )}
      </section>
    </>
  )
}

function PlaceContent({ place }: { place: PendingPlace }) {
  return (
    <div className="space-y-3 text-sm text-[#222222]">
      <Field label="Description">{place.description ?? <em className="text-[#9ca3af]">없음</em>}</Field>
      <Field label="전화">{place.phone ?? <em className="text-[#9ca3af]">없음</em>}</Field>
      <Field label="평점">
        {place.rating != null ? `★ ${place.rating} (${place.review_count ?? 0}건)` : <em className="text-[#9ca3af]">없음</em>}
      </Field>
      <Field label="서비스">
        {place.services && place.services.length > 0 ? (
          <ul className="list-disc space-y-1 pl-4">
            {place.services.map((s, i) => (
              <li key={i}>
                <strong>{s.name}</strong>
                {s.priceRange && <span className="ml-1 text-[#6a6a6a]">({s.priceRange})</span>}
                {s.description && <p className="text-xs text-[#6a6a6a]">{s.description}</p>}
              </li>
            ))}
          </ul>
        ) : <em className="text-[#9ca3af]">없음</em>}
      </Field>
      <Field label="FAQ">
        {place.faqs && place.faqs.length > 0 ? (
          <ul className="space-y-2">
            {place.faqs.map((f, i) => (
              <li key={i}>
                <p className="font-medium">Q. {f.question}</p>
                <p className="text-xs text-[#6a6a6a]">A. {f.answer}</p>
              </li>
            ))}
          </ul>
        ) : <em className="text-[#9ca3af]">없음</em>}
      </Field>
      <Field label="태그">
        {place.tags && place.tags.length > 0 ? place.tags.join(', ') : <em className="text-[#9ca3af]">없음</em>}
      </Field>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase text-[#6a6a6a]">{label}</p>
      <div className="mt-0.5">{children}</div>
    </div>
  )
}

function RejectPanel({ onSubmit, onCancel }: { onSubmit: (r: RejectReason, note?: string) => void; onCancel: () => void }) {
  const [reason, setReason] = useState<RejectReason>('fact_error')
  const [note, setNote] = useState('')
  return (
    <div className="mt-4 rounded-md border border-[#fca5a5] bg-[#fef2f2] p-3">
      <p className="mb-2 text-xs font-semibold text-[#991b1b]">반려 사유</p>
      <div className="mb-2 grid grid-cols-5 gap-1">
        {REJECT_REASONS.map(r => (
          <button
            key={r}
            type="button"
            onClick={() => setReason(r)}
            className={`rounded px-2 py-1 text-xs ${
              reason === r ? 'bg-[#dc2626] text-white' : 'bg-white text-[#991b1b] hover:bg-[#fee2e2]'
            }`}
          >
            {rejectReasonLabel(r)}
          </button>
        ))}
      </div>
      <textarea
        value={note}
        onChange={e => setNote(e.target.value)}
        rows={2}
        placeholder="메모 (선택)"
        className="w-full rounded border border-[#fca5a5] bg-white px-2 py-1 text-xs"
      />
      <div className="mt-2 flex justify-end gap-1">
        <button
          type="button"
          onClick={onCancel}
          className="h-8 rounded border border-[#dddddd] bg-white px-3 text-xs text-[#484848]"
        >
          취소
        </button>
        <button
          type="button"
          onClick={() => onSubmit(reason, note.trim() || undefined)}
          className="h-8 rounded bg-[#dc2626] px-3 text-xs text-white"
        >
          반려 확정
        </button>
      </div>
    </div>
  )
}
