// 설계안 §3.10 — 만료 임박 카드 리스트 + 자동 안내 발송 이력.

import { requireAuth } from '@/lib/auth'
import { listExpiringCards } from '@/lib/admin/billing-queries'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default async function BillingExpiringPage() {
  await requireAuth()
  const rows = await listExpiringCards(60)

  return (
    <div className="px-6 py-5">
      <header className="mb-5">
        <h1 className="text-xl font-semibold">만료 임박 카드</h1>
        <p className="mt-1 text-sm text-[#6b6b6b]">
          60일 이내 만료 예정. 매일 Cron 이 30일·7일 임계에서 자동 안내 메일을 발송합니다.
        </p>
      </header>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-[#e7e7e7] bg-white p-10 text-center text-sm text-[#6b6b6b]">
          60일 이내 만료 예정 카드가 없습니다.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[#e7e7e7] bg-white">
          <table className="w-full text-sm">
            <thead className="bg-[#fafafa] text-left text-xs uppercase tracking-wider text-[#6b6b6b]">
              <tr>
                <th className="px-4 py-3 font-medium">고객</th>
                <th className="px-4 py-3 font-medium">카드</th>
                <th className="px-4 py-3 font-medium">만료</th>
                <th className="px-4 py-3 font-medium">남은 일수</th>
                <th className="px-4 py-3 font-medium">알림</th>
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
                    <div>{r.cardCompany ?? '—'}</div>
                    <div className="font-mono text-xs text-[#6b6b6b]">{r.cardNumberMasked ?? '—'}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#6b6b6b]">
                    {r.expiryYear && r.expiryMonth ? `${r.expiryYear}-${String(r.expiryMonth).padStart(2, '0')}` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <DaysPill days={r.daysLeft} />
                  </td>
                  <td className="px-4 py-3 text-xs text-[#6b6b6b]">
                    {r.daysLeft <= 7 ? '7일 안내 대기' : r.daysLeft <= 30 ? '30일 안내 대기' : '—'}
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

function DaysPill({ days }: { days: number }) {
  const cls = days <= 7 ? 'bg-red-50 text-red-700 border-red-200'
    : days <= 30 ? 'bg-amber-50 text-amber-700 border-amber-200'
    : 'bg-[#f3f4f6] text-[#6b6b6b] border-[#e7e7e7]'
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${cls}`}>{days}일</span>
}
