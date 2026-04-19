'use client'

// 클레임 승인/거절 버튼. 승인 시 서버에서 owner 자동 재할당.
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { resolveClaim } from '@/lib/actions/reports-claims'

export function ClaimRowActions({ claimId }: { claimId: string }) {
  const [pending, startTransition] = useTransition()
  const [noteVisible, setNoteVisible] = useState(false)
  const [note, setNote] = useState('')
  const router = useRouter()

  function run(decision: 'approved' | 'rejected') {
    const confirmMsg = decision === 'approved'
      ? '승인하면 업체 owner 가 claimant 로 재할당됩니다. 계속할까요?'
      : '거절 처리합니다. 계속할까요?'
    if (!confirm(confirmMsg)) return

    startTransition(async () => {
      const r = await resolveClaim(claimId, decision, note || undefined)
      if (r.success) router.refresh()
      else alert(r.error)
    })
  }

  return (
    <div className="flex flex-col items-end gap-2 shrink-0">
      {noteVisible && (
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          rows={2}
          placeholder="처리 메모"
          className="w-48 rounded-md border border-[#dddddd] px-2 py-1 text-xs"
        />
      )}
      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => setNoteVisible(!noteVisible)}
          className="h-7 rounded border border-[#dddddd] px-2 text-[11px] hover:bg-[#f2f2f2]"
        >
          📝
        </button>
        <button
          type="button"
          onClick={() => run('approved')}
          disabled={pending}
          className="h-7 rounded bg-[#008060] px-3 text-[11px] text-white hover:bg-[#006e52] disabled:opacity-50"
        >
          승인
        </button>
        <button
          type="button"
          onClick={() => run('rejected')}
          disabled={pending}
          className="h-7 rounded border border-red-400 px-3 text-[11px] text-red-700 hover:bg-red-50 disabled:opacity-50"
        >
          거절
        </button>
      </div>
    </div>
  )
}
