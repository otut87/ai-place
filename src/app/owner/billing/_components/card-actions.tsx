'use client'

// T-222/T-223.5 — 다중 카드 UI: "기본으로 설정" / "삭제" 버튼.
// 서버 액션 호출 후 router.refresh() 로 페이지 재로딩.

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { setPrimaryBillingKeyAction, revokeBillingKeyAction } from '@/lib/actions/owner-billing'

export function CardRowActions({
  keyId, isPrimary, isOnlyCard,
}: {
  keyId: string
  isPrimary: boolean
  isOnlyCard: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleSetPrimary() {
    setError(null)
    startTransition(async () => {
      const r = await setPrimaryBillingKeyAction(keyId)
      if (!r.success) setError(r.error ?? '변경 실패')
      else router.refresh()
    })
  }

  function handleRevoke() {
    if (isOnlyCard) {
      setError('유일한 카드는 삭제할 수 없습니다. 다른 카드를 먼저 등록하세요.')
      return
    }
    if (!window.confirm('이 카드를 삭제하시겠습니까?')) return
    setError(null)
    startTransition(async () => {
      const r = await revokeBillingKeyAction(keyId)
      if (!r.success) setError(r.error ?? '삭제 실패')
      else router.refresh()
    })
  }

  return (
    <div className="actions">
      {!isPrimary && (
        <button type="button" onClick={handleSetPrimary} disabled={pending}>
          기본으로
        </button>
      )}
      <button
        type="button" className="danger"
        onClick={handleRevoke}
        disabled={pending || (isPrimary && isOnlyCard)}
        title={isPrimary && isOnlyCard ? '유일한 primary 카드는 삭제 불가' : undefined}
      >
        삭제
      </button>
      {error && (
        <span style={{ fontSize: 11, color: '#c24b2f', marginLeft: 8 }}>
          {error}
        </span>
      )}
    </div>
  )
}
