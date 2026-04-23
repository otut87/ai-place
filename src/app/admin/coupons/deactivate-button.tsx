'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deactivateCouponAction } from '@/lib/actions/admin-coupon'

export function DeactivateButton({ couponId, code }: { couponId: string; code: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function handle() {
    if (!window.confirm(`"${code}" 쿠폰을 즉시 만료시키시겠습니까? 이미 발급된 건도 사용 불가해집니다.`)) return
    startTransition(async () => {
      const r = await deactivateCouponAction(couponId)
      if (!r.success) window.alert(r.error ?? '실패')
      else router.refresh()
    })
  }

  return (
    <button
      type="button" onClick={handle} disabled={pending}
      className="text-[12px] text-[#9a2c00] hover:underline disabled:opacity-50"
    >
      {pending ? '…' : '비활성화'}
    </button>
  )
}
