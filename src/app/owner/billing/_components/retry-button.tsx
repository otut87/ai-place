'use client'

// T-224 — past_due 상태에서 오너가 직접 재시도 요청.
// rate limit + advisory lock 은 서버 액션에서 처리.

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ownerRetryBillingAction } from '@/lib/actions/owner-billing-retry'

export function RetryButton({ subscriptionId }: { subscriptionId: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  function handle() {
    setError(null)
    setSuccess(false)
    startTransition(async () => {
      const r = await ownerRetryBillingAction(subscriptionId)
      if (!r.success) {
        setError(r.error)
        return
      }
      if (r.status === 'active') {
        setSuccess(true)
        router.refresh()
      } else {
        setError(r.status === 'past_due'
          ? '결제에 다시 실패했습니다. 카드 변경을 권장합니다.'
          : '결제 시도가 종료되었습니다.')
        router.refresh()
      }
    })
  }

  if (success) {
    return <span style={{ color: 'var(--good)', fontSize: 12 }}>✓ 결제 성공</span>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <button type="button" className="primary" onClick={handle} disabled={pending}>
        {pending ? '재시도 중…' : '지금 재시도'}
      </button>
      {error && (
        <span style={{ fontSize: 11, color: '#c24b2f' }}>{error}</span>
      )}
    </div>
  )
}
