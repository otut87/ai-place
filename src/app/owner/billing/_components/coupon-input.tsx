'use client'

// T-229 — 오너 쿠폰 입력 폼.
// 입력 → redeemCouponAction → 성공 시 메시지 + router.refresh()

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { redeemCouponAction } from '@/lib/actions/owner-coupon'

interface Props {
  /** 이미 등록된 미적용 쿠폰 코드. 있으면 입력 폼 대신 "적용 예정" 뱃지. */
  pendingCode?: string | null
  /** percent | fixed. pendingCode 있을 때만 사용. */
  pendingDiscountType?: 'percent' | 'fixed'
  pendingDiscountValue?: number
}

export function CouponInput({ pendingCode, pendingDiscountType, pendingDiscountValue }: Props) {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ text: string; tone: 'ok' | 'err' } | null>(null)

  if (pendingCode) {
    const discountLabel = pendingDiscountType === 'percent'
      ? `${pendingDiscountValue}% 할인`
      : `₩${pendingDiscountValue?.toLocaleString('ko-KR')} 할인`
    return (
      <div style={{
        padding: '10px 14px', borderRadius: 10,
        background: 'color-mix(in oklab, var(--good) 10%, transparent)',
        border: '1px solid color-mix(in oklab, var(--good) 24%, transparent)',
        color: 'var(--good)', fontSize: 13, display: 'flex', gap: 8, alignItems: 'center',
      }}>
        <span>🎟️</span>
        <span>
          <b>{pendingCode}</b> · {discountLabel} · 다음 결제에 자동 적용 예정
        </span>
      </div>
    )
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)
    startTransition(async () => {
      const r = await redeemCouponAction(code)
      if (!r.success) {
        setMessage({ text: r.error, tone: 'err' })
        return
      }
      const label = r.discountType === 'percent'
        ? `${r.discountValue}% 할인`
        : `₩${r.discountValue.toLocaleString('ko-KR')} 할인`
      setMessage({ text: `${r.couponCode} 적용됨 · ${label} · 다음 결제 시 반영`, tone: 'ok' })
      setCode('')
      router.refresh()
    })
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="쿠폰 코드 입력"
          maxLength={32}
          aria-label="쿠폰 코드"
          disabled={pending}
          style={{
            flex: 1, padding: '9px 12px',
            border: '1px solid var(--line-2)', borderRadius: 8,
            fontFamily: 'var(--mono)', fontSize: 13, letterSpacing: '.05em',
            background: 'var(--bg)', color: 'var(--ink)', outline: 'none',
          }}
        />
        <button
          type="submit"
          disabled={pending || !code}
          style={{
            padding: '0 16px', borderRadius: 8,
            background: 'var(--ink)', color: '#fff', border: 'none',
            font: '500 13px var(--font), system-ui, sans-serif', cursor: 'pointer',
          }}
        >
          {pending ? '적용 중…' : '적용'}
        </button>
      </div>
      {message && (
        <span style={{
          fontSize: 11.5,
          color: message.tone === 'ok' ? 'var(--good)' : '#c24b2f',
        }}>
          {message.text}
        </span>
      )}
    </form>
  )
}
