'use client'

// 신고 건의 상태 업데이트 버튼 (해결/기각).
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateReportStatus } from '@/lib/actions/reports-claims'

export function ReportRowActions({ reportId }: { reportId: string }) {
  const [pending, startTransition] = useTransition()
  const [noteVisible, setNoteVisible] = useState(false)
  const [note, setNote] = useState('')
  const router = useRouter()

  function run(status: 'resolved' | 'dismissed') {
    startTransition(async () => {
      const r = await updateReportStatus(reportId, status, note || undefined)
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
          placeholder="메모 (선택)"
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
          onClick={() => run('resolved')}
          disabled={pending}
          className="h-7 rounded bg-[#008060] px-3 text-[11px] text-white hover:bg-[#006e52] disabled:opacity-50"
        >
          해결
        </button>
        <button
          type="button"
          onClick={() => run('dismissed')}
          disabled={pending}
          className="h-7 rounded border border-[#dddddd] px-3 text-[11px] text-[#484848] hover:bg-[#f2f2f2] disabled:opacity-50"
        >
          기각
        </button>
      </div>
    </div>
  )
}
