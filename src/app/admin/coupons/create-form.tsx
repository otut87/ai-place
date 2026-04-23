'use client'

// T-229 — 어드민 쿠폰 생성 폼.

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createCouponAction } from '@/lib/actions/admin-coupon'

export function CouponCreateForm() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [code, setCode] = useState('')
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent')
  const [discountValue, setDiscountValue] = useState(20)
  const [validUntil, setValidUntil] = useState('')
  const [maxUses, setMaxUses] = useState('')
  const [note, setNote] = useState('')
  const [message, setMessage] = useState<{ text: string; tone: 'ok' | 'err' } | null>(null)

  function reset() {
    setCode('')
    setDiscountValue(20)
    setValidUntil('')
    setMaxUses('')
    setNote('')
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)
    startTransition(async () => {
      const r = await createCouponAction({
        code,
        discountType,
        discountValue,
        validUntil: validUntil ? new Date(validUntil).toISOString() : null,
        maxUses: maxUses ? Number(maxUses) : null,
        note,
      })
      if (!r.success) {
        setMessage({ text: r.error, tone: 'err' })
        return
      }
      setMessage({ text: `쿠폰 "${code}" 생성됨`, tone: 'ok' })
      reset()
      router.refresh()
    })
  }

  return (
    <form onSubmit={onSubmit}
      className="rounded-xl border border-[#e7e7e7] bg-white p-4"
      style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10, alignItems: 'end' }}
    >
      <label style={{ gridColumn: 'span 2' }}>
        <div className="mb-1 text-[11px] uppercase tracking-wider text-[#6b6b6b]">코드</div>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="LAUNCH20"
          required maxLength={32}
          className="w-full rounded-md border border-[#e7e7e7] px-3 py-2 font-mono text-[13px]"
        />
      </label>
      <label>
        <div className="mb-1 text-[11px] uppercase tracking-wider text-[#6b6b6b]">유형</div>
        <select
          value={discountType}
          onChange={(e) => setDiscountType(e.target.value as 'percent' | 'fixed')}
          className="w-full rounded-md border border-[#e7e7e7] px-3 py-2 text-[13px]"
        >
          <option value="percent">percent (%)</option>
          <option value="fixed">fixed (원)</option>
        </select>
      </label>
      <label>
        <div className="mb-1 text-[11px] uppercase tracking-wider text-[#6b6b6b]">값</div>
        <input
          type="number"
          value={discountValue}
          onChange={(e) => setDiscountValue(Number(e.target.value))}
          min={1} max={discountType === 'percent' ? 100 : undefined}
          className="w-full rounded-md border border-[#e7e7e7] px-3 py-2 font-mono text-[13px]"
          required
        />
      </label>
      <label>
        <div className="mb-1 text-[11px] uppercase tracking-wider text-[#6b6b6b]">유효기간</div>
        <input
          type="date"
          value={validUntil}
          onChange={(e) => setValidUntil(e.target.value)}
          className="w-full rounded-md border border-[#e7e7e7] px-3 py-2 text-[13px]"
        />
      </label>
      <label>
        <div className="mb-1 text-[11px] uppercase tracking-wider text-[#6b6b6b]">최대 사용</div>
        <input
          type="number" min={1} placeholder="무제한"
          value={maxUses}
          onChange={(e) => setMaxUses(e.target.value)}
          className="w-full rounded-md border border-[#e7e7e7] px-3 py-2 font-mono text-[13px]"
        />
      </label>
      <label style={{ gridColumn: 'span 5' }}>
        <div className="mb-1 text-[11px] uppercase tracking-wider text-[#6b6b6b]">메모 (캠페인명 등)</div>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="예: 2026-05 launch promo"
          className="w-full rounded-md border border-[#e7e7e7] px-3 py-2 text-[13px]"
        />
      </label>
      <div style={{ gridColumn: 'span 1', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <button type="submit" disabled={pending}
          className="rounded-md bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {pending ? '생성 중…' : '발급'}
        </button>
      </div>
      {message && (
        <div style={{ gridColumn: 'span 6' }} className={`text-[12px] ${message.tone === 'ok' ? 'text-[#047857]' : 'text-[#9a2c00]'}`}>
          {message.text}
        </div>
      )}
    </form>
  )
}
