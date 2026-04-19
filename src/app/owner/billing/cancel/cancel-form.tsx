'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { cancelSubscriptionAction } from '@/lib/actions/subscription-cancel'

const REASONS = [
  '비용이 부담스럽다',
  '효과가 기대만큼 아니다',
  '사업을 접는다/이전한다',
  '다른 서비스로 이전',
  '기능이 부족하다',
  '기타',
]

interface Props {
  subscriptionId: string
  nextChargeAt: string | null
}

export function CancelForm({ subscriptionId, nextChargeAt }: Props) {
  const [mode, setMode] = useState<'immediate' | 'end_of_period'>('end_of_period')
  const [reason, setReason] = useState('')
  const [feedback, setFeedback] = useState('')
  const [confirm, setConfirm] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ mode: string; date: string } | null>(null)
  const router = useRouter()

  async function submit() {
    if (!confirm) { setError('확인 체크박스에 동의해 주세요'); return }
    if (!reason) { setError('사유를 선택해 주세요'); return }
    setError(null)
    setPending(true)
    const r = await cancelSubscriptionAction({ subscriptionId, mode, reason, feedback })
    setPending(false)
    if (!r.success) { setError(r.error); return }
    setDone({ mode: r.mode, date: r.effectiveDate })
  }

  if (done) {
    return (
      <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900">
        <p className="font-semibold">✅ 해지 처리 완료</p>
        <p className="mt-1 text-xs">
          {done.mode === 'immediate'
            ? '즉시 해지되었습니다. 다음 결제는 발생하지 않습니다.'
            : `${new Date(done.date).toLocaleDateString('ko-KR')} 에 해지됩니다. 그 때까지는 기능 이용 가능합니다.`}
        </p>
        <button onClick={() => router.push('/owner')} className="mt-3 rounded bg-emerald-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-emerald-700">
          내 업체로
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* 모드 선택 */}
      <div>
        <p className="text-xs font-medium text-[#484848]">해지 시점</p>
        <div className="mt-2 space-y-2">
          <label className="flex items-start gap-2 rounded-lg border border-[#e5e7eb] p-3 text-xs hover:bg-[#fafafa]">
            <input type="radio" checked={mode === 'end_of_period'} onChange={() => setMode('end_of_period')} />
            <div>
              <div className="font-medium text-[#191919]">기간 만료 후 해지 (권장)</div>
              <div className="text-[#6a6a6a]">
                {nextChargeAt ? `${new Date(nextChargeAt).toLocaleDateString('ko-KR')} 까지 이용 후 자동 해지` : '이미 결제 기간 끝'}
              </div>
            </div>
          </label>
          <label className="flex items-start gap-2 rounded-lg border border-[#e5e7eb] p-3 text-xs hover:bg-[#fafafa]">
            <input type="radio" checked={mode === 'immediate'} onChange={() => setMode('immediate')} />
            <div>
              <div className="font-medium text-[#191919]">즉시 해지</div>
              <div className="text-[#6a6a6a]">잔여 기간 환불 없음. 즉시 기능 중단</div>
            </div>
          </label>
        </div>
      </div>

      {/* 사유 */}
      <div>
        <p className="text-xs font-medium text-[#484848]">해지 사유 *</p>
        <select value={reason} onChange={e => setReason(e.target.value)}
          className="mt-1 h-10 w-full rounded-lg border border-[#dddddd] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#008060]">
          <option value="">선택</option>
          {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      <div>
        <p className="text-xs font-medium text-[#484848]">의견 (선택)</p>
        <textarea value={feedback} onChange={e => setFeedback(e.target.value)} rows={3}
          placeholder="개선하면 좋을 점을 알려주세요"
          className="mt-1 w-full rounded-lg border border-[#dddddd] p-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#008060]" />
      </div>

      <label className="flex items-start gap-2 text-xs">
        <input type="checkbox" checked={confirm} onChange={e => setConfirm(e.target.checked)} className="mt-0.5" />
        <span>해지 후 일부 기능이 중단됨을 이해하고 동의합니다.</span>
      </label>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <button onClick={submit} disabled={pending || !confirm || !reason}
        className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
        {pending ? '처리 중...' : '해지 확정'}
      </button>
    </div>
  )
}
