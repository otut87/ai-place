// T-073 — /admin/billing/failures — 결제 실패 큐.
// 컬럼: 고객 · 사유(한국어) · 재시도 상태 · 마지막 시도 · 액션(재시도 / 사장님 링크)

import { requireAuth } from '@/lib/auth'
import { listBillingFailures, FAILURE_CATEGORY_LABEL, badgeToneForSubscription } from '@/lib/admin/billing-failures'
import { BillingRetryButton } from './retry-button'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default async function BillingFailuresPage() {
  await requireAuth()
  const rows = await listBillingFailures(100)

  return (
    <div className="px-6 py-5">
      <header className="mb-5">
        <h1 className="text-xl font-semibold">결제 실패 큐</h1>
        <p className="mt-1 text-sm text-[#6b6b6b]">
          재시도 정책: +1일 → +3일 → +7일 (총 3회). 3회 실패 시 구독 일시 중단.
        </p>
      </header>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-[#e7e7e7] bg-white p-10 text-center text-sm text-[#6b6b6b]">
          실패 건이 없습니다.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[#e7e7e7] bg-white">
          <table className="w-full text-sm">
            <thead className="bg-[#fafafa] text-left text-xs uppercase tracking-wider text-[#6b6b6b]">
              <tr>
                <th className="px-4 py-3 font-medium">고객</th>
                <th className="px-4 py-3 font-medium">사유</th>
                <th className="px-4 py-3 font-medium">구독 상태</th>
                <th className="px-4 py-3 font-medium">재시도</th>
                <th className="px-4 py-3 font-medium">다음 시도</th>
                <th className="px-4 py-3 font-medium">마지막 시도</th>
                <th className="px-4 py-3 font-medium">액션</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f0f0]">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-[#fafafa]">
                  <td className="px-4 py-3">
                    <div className="font-medium text-[#191919]">{r.customerName ?? '(이름 없음)'}</div>
                    <div className="text-xs text-[#6b6b6b]">{r.customerEmail ?? '—'}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-[#191919]">{FAILURE_CATEGORY_LABEL[r.category]}</div>
                    <div className="text-xs text-[#6b6b6b]">{r.responseMessage ?? r.responseCode ?? '—'}</div>
                  </td>
                  <td className="px-4 py-3">
                    <SubscriptionBadge status={r.subscriptionStatus} />
                  </td>
                  <td className="px-4 py-3">{r.failedRetryCount} / 3</td>
                  <td className="px-4 py-3 text-[#6b6b6b]">
                    {r.nextChargeAt ? new Date(r.nextChargeAt).toLocaleDateString('ko-KR') : '—'}
                  </td>
                  <td className="px-4 py-3 text-[#6b6b6b]">
                    {new Date(r.attemptedAt).toLocaleString('ko-KR')}
                  </td>
                  <td className="px-4 py-3">
                    <BillingRetryButton
                      subscriptionId={r.subscriptionId}
                      disabled={r.subscriptionStatus === 'canceled' || r.subscriptionStatus === 'suspended'}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function SubscriptionBadge({ status }: { status: string }) {
  const tone = badgeToneForSubscription(status)
  const cls =
    tone === 'danger' ? 'bg-red-50 text-red-700 border-red-200'
    : tone === 'warn' ? 'bg-amber-50 text-amber-700 border-amber-200'
    : 'bg-[#f7f7f7] text-[#191919] border-[#e7e7e7]'
  const label =
    status === 'past_due' ? '연체 중'
    : status === 'suspended' ? '일시 중단'
    : status === 'canceled' ? '해지'
    : status
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${cls}`}>{label}</span>
}
