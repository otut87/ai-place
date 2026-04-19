'use client'

// T-093 — 블로그 검수 큐 (draft → active/archived).
// 업체 검수와 동일 UX: 좌측 큐 + 우측 프리뷰 + 승인/반려/편집 링크.

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AdminLink } from '@/components/admin/admin-link'
import { approveBlogPost, rejectBlogPost } from '@/lib/actions/blog-review'
import { renderMarkdown } from '@/lib/admin/blog-editor'
import { useToast } from '@/components/admin/toast'
import { Check, X, Pencil } from 'lucide-react'
import { REJECT_REASONS, rejectReasonLabel, type RejectReason } from '@/lib/admin/review-queue'

export interface PendingBlogPost {
  id: string
  slug: string
  title: string
  summary: string
  content: string
  category: string | null
  post_type: string
  tags: string[]
  created_at: string
}

export function BlogReviewQueueClient({
  pending,
  initialBlogSlug,
}: {
  pending: PendingBlogPost[]
  initialBlogSlug: string | null
}) {
  const router = useRouter()
  const toast = useToast()
  const [pendingIdx, setPendingIdx] = useState(() => {
    const idx = initialBlogSlug ? pending.findIndex(p => p.slug === initialBlogSlug) : 0
    return idx >= 0 ? idx : 0
  })
  const current = pending[pendingIdx] ?? null
  const [transition, start] = useTransition()
  const [reason, setReason] = useState<RejectReason>('fact_error')
  const [note, setNote] = useState('')

  function approve() {
    if (!current) return
    start(async () => {
      const r = await approveBlogPost(current.slug)
      if (r.success) { toast.success('발행'); router.refresh() }
      else toast.error(r.error ?? '실패')
    })
  }

  function reject() {
    if (!current) return
    start(async () => {
      const r = await rejectBlogPost({ slug: current.slug, reason, note: note.trim() || undefined })
      if (r.success) { toast.success('반려'); setNote(''); router.refresh() }
      else toast.error(r.error ?? '실패')
    })
  }

  return (
    <div className="flex w-full">
      {/* 좌측 큐 */}
      <aside className="w-72 shrink-0 border-r border-[#e7e7e7] bg-white">
        <div className="border-b border-[#f0f0f0] px-4 py-2 text-xs text-[#6b6b6b]">초안 {pending.length}건</div>
        <ul className="max-h-[calc(100vh-6rem)] overflow-y-auto">
          {pending.map((p, i) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => setPendingIdx(i)}
                className={`block w-full truncate px-4 py-2 text-left text-sm ${
                  i === pendingIdx ? 'bg-[#f3f4f6] font-medium' : 'hover:bg-[#fafafa]'
                }`}
              >
                <div className="truncate text-[#191919]">{p.title}</div>
                <div className="text-[10px] text-[#6b6b6b]">{p.category ?? '—'} · {p.post_type}</div>
              </button>
            </li>
          ))}
          {pending.length === 0 && <li className="px-4 py-6 text-center text-sm text-[#9a9a9a]">초안 없음</li>}
        </ul>
      </aside>

      {/* 우측 프리뷰 + 액션 */}
      <main className="flex min-w-0 flex-1 flex-col">
        {!current ? (
          <div className="flex flex-1 items-center justify-center text-sm text-[#6b6b6b]">선택된 초안이 없습니다.</div>
        ) : (
          <>
            <header className="flex items-start justify-between border-b border-[#e7e7e7] bg-white px-6 py-3">
              <div className="min-w-0">
                <h2 className="truncate text-lg font-semibold text-[#191919]">{current.title}</h2>
                <p className="mt-0.5 text-xs text-[#6b6b6b]">{current.summary}</p>
              </div>
              <div className="flex items-center gap-2">
                <AdminLink
                  href={`/admin/blog/${current.slug}/edit`}
                  className="inline-flex h-9 items-center gap-1 rounded-md border border-[#e7e7e7] bg-white px-3 text-sm hover:bg-[#fafafa]"
                >
                  <Pencil className="h-3.5 w-3.5" /> 편집
                </AdminLink>
                <button
                  type="button"
                  disabled={transition}
                  onClick={approve}
                  className="inline-flex h-9 items-center gap-1 rounded-md bg-emerald-600 px-3 text-sm text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  <Check className="h-3.5 w-3.5" /> 발행
                </button>
              </div>
            </header>

            <div className="flex min-h-0 flex-1">
              <div className="min-w-0 flex-1 overflow-y-auto bg-[#fafafa] p-6">
                <article
                  className="prose prose-sm max-w-none rounded-lg bg-white p-6"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(current.content) }}
                />
              </div>

              <aside className="w-80 shrink-0 border-l border-[#e7e7e7] bg-white p-4">
                <h3 className="mb-2 text-sm font-semibold text-[#191919]">반려</h3>
                <label className="mb-2 block text-xs text-[#6b6b6b]">
                  사유
                  <select
                    value={reason}
                    onChange={e => setReason(e.target.value as RejectReason)}
                    className="mt-1 block h-9 w-full rounded-md border border-[#e7e7e7] bg-white px-2 text-sm"
                  >
                    {REJECT_REASONS.map(r => <option key={r} value={r}>{rejectReasonLabel(r)}</option>)}
                  </select>
                </label>
                <label className="mb-3 block text-xs text-[#6b6b6b]">
                  메모 (선택)
                  <textarea
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    rows={3}
                    className="mt-1 block w-full rounded-md border border-[#e7e7e7] bg-white p-2 text-sm"
                  />
                </label>
                <button
                  type="button"
                  disabled={transition}
                  onClick={reject}
                  className="inline-flex h-9 w-full items-center justify-center gap-1 rounded-md border border-red-200 bg-white px-3 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  <X className="h-3.5 w-3.5" /> 반려
                </button>
              </aside>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
