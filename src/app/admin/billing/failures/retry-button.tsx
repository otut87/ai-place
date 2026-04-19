'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { retryBillingFailure } from '@/lib/actions/billing-retry'
import { useToast } from '@/components/admin/toast'

export function BillingRetryButton({
  subscriptionId,
  disabled = false,
}: {
  subscriptionId: string
  disabled?: boolean
}) {
  const [pending, start] = useTransition()
  const router = useRouter()
  const toast = useToast()

  return (
    <button
      type="button"
      disabled={disabled || pending}
      onClick={() => {
        start(async () => {
          const r = await retryBillingFailure(subscriptionId)
          if (r.success) {
            toast.success('재시도 요청을 전송했습니다.')
            router.refresh()
          } else {
            toast.error(r.error ?? '재시도 실패')
          }
        })
      }}
      className="rounded-full border border-[#e7e7e7] bg-white px-3 py-1.5 text-xs font-medium text-[#191919] transition-colors hover:border-[#d1d1d1] hover:bg-[#fafafa] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? '재시도 중…' : '재시도'}
    </button>
  )
}
