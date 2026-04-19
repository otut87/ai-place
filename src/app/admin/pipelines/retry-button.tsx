'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { retryPipelineJobAction } from '@/lib/actions/pipeline-retry'
import { useToast } from '@/components/admin/toast'

export function RetryJobButton({ jobId, disabled = false }: { jobId: string; disabled?: boolean }) {
  const [pending, start] = useTransition()
  const router = useRouter()
  const toast = useToast()

  return (
    <button
      type="button"
      disabled={disabled || pending}
      onClick={() => {
        start(async () => {
          const r = await retryPipelineJobAction(jobId)
          if (r.success) {
            toast.success('재시도 큐에 등록했습니다.')
            router.refresh()
          } else {
            toast.error(r.error ?? '재시도 실패')
          }
        })
      }}
      className="rounded-full border border-[#e7e7e7] bg-white px-3 py-1 text-xs font-medium text-[#191919] transition-colors hover:border-[#d1d1d1] hover:bg-[#fafafa] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? '재시도 중…' : '재시도'}
    </button>
  )
}
