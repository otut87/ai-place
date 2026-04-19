// T-088 — 해지 예정 리스트 (설계안 §3.10).

import { requireAuth } from '@/lib/auth'
import { listPendingCancellations } from '@/lib/admin/billing-queries'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default async function BillingCancellationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireAuth()
  const raw = await searchParams
  const scope = (Array.isArray(raw.scope) ? raw.scope[0] : raw.scope) ?? 'this_month'

  const rows = await listPendingCancellations({ thisMonthOnly: scope === 'this_month' })

  return (
    <div className="px-6 py-5">
      <header className="mb-5">
        <h1 className="text-xl font-semibold">해지 예정</h1>
        <p className="mt-1 text-sm text-[#6b6b6b]">
          해지 요청은 당월 말까지 서비스 유지 후 종료됩니다.
        </p>
      </header>

      <form method="get" className="mb-4 flex items-center gap-2 text-sm">
        <select name="scope" defaultValue={scope} className="h-9 rounded-md border border-[#e7e7e7] bg-white px-2">
          <option value="this_month">이번 달</option>
          <option value="all">전체 (미래 포함)</option>
        </select>
        <button type="submit" className="h-9 rounded-md bg-[#191919] px-3 text-white">적용</button>
      </form>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-[#e7e7e7] bg-white p-10 text-center text-sm text-[#6b6b6b]">
          해지 예정이 없습니다.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[#e7e7e7] bg-white">
          <table className="w-full text-sm">
            <thead className="bg-[#fafafa] text-left text-xs uppercase tracking-wider text-[#6b6b6b]">
              <tr>
                <th className="px-4 py-3 font-medium">고객</th>
                <th className="px-4 py-3 font-medium">해지 요청일</th>
                <th className="px-4 py-3 font-medium">종료 예정일</th>
                <th className="px-4 py-3 font-medium">사유</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f0f0]">
              {rows.map((r) => (
                <tr key={r.subscriptionId}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-[#191919]">{r.customerName ?? '(이름 없음)'}</div>
                    <div className="text-xs text-[#6b6b6b]">{r.customerEmail ?? '—'}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#6b6b6b]">
                    {new Date(r.canceledAt).toLocaleDateString('ko-KR')}
                  </td>
                  <td className="px-4 py-3">
                    {new Date(r.effectiveDate).toLocaleDateString('ko-KR')}
                  </td>
                  <td className="px-4 py-3 text-xs text-[#6b6b6b]">{r.cancelReason ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
