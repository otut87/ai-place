// T-082 — /admin/customers — 고객 라이프사이클·LTV·코호트.

import { requireAuth } from '@/lib/auth'
import { buildCohorts, listCustomersWithAnalytics } from '@/lib/admin/customer-analytics'
import { AdminLink } from '@/components/admin/admin-link'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default async function AdminCustomersPage() {
  await requireAuth()
  const rows = await listCustomersWithAnalytics(200)
  const cohorts = buildCohorts(rows, 6)

  const ltvAvg =
    rows.length === 0 ? 0 : rows.reduce((a, r) => a + r.paidTotal, 0) / rows.length

  return (
    <div className="px-6 py-5">
      <header className="mb-5">
        <h1 className="text-xl font-semibold">고객 분석</h1>
        <p className="mt-1 text-sm text-[#6b6b6b]">LTV · 월별 코호트 리텐션 · 해지 예측의 기반.</p>
      </header>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="고객 수" value={rows.length.toLocaleString('ko-KR')} />
        <Stat label="평균 LTV" value={`${Math.round(ltvAvg).toLocaleString('ko-KR')}원`} />
        <Stat label="활성 구독" value={rows.filter(r => r.subscriptionStatus === 'active').length.toLocaleString('ko-KR')} />
        <Stat label="해지" value={rows.filter(r => r.subscriptionStatus === 'canceled' || r.subscriptionStatus === 'suspended').length.toLocaleString('ko-KR')} />
      </div>

      <section className="mb-6">
        <h2 className="mb-3 text-sm font-medium text-[#191919]">코호트 리텐션 (월 오프셋)</h2>
        {cohorts.length === 0 ? (
          <div className="rounded-xl border border-[#e7e7e7] bg-white p-6 text-sm text-[#6b6b6b]">결제 이력 없음</div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-[#e7e7e7] bg-white">
            <table className="w-full text-sm">
              <thead className="bg-[#fafafa] text-left text-xs uppercase tracking-wider text-[#6b6b6b]">
                <tr>
                  <th className="px-4 py-3 font-medium">코호트</th>
                  <th className="px-4 py-3 font-medium">신규</th>
                  {[0, 1, 2, 3, 4, 5].map((m) => (
                    <th key={m} className="px-3 py-3 text-center font-medium">M{m}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0f0f0]">
                {cohorts.map((c) => (
                  <tr key={c.cohortMonth}>
                    <td className="px-4 py-3 font-medium text-[#191919]">{c.cohortMonth}</td>
                    <td className="px-4 py-3 text-[#6b6b6b]">{c.cohortSize}</td>
                    {c.retentionByMonthOffset.map((r, i) => (
                      <td key={i} className="px-3 py-3 text-center">
                        <RetentionCell r={r} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-[#191919]">고객 목록</h2>
        <div className="overflow-hidden rounded-xl border border-[#e7e7e7] bg-white">
          <table className="w-full text-sm">
            <thead className="bg-[#fafafa] text-left text-xs uppercase tracking-wider text-[#6b6b6b]">
              <tr>
                <th className="px-4 py-3 font-medium">고객</th>
                <th className="px-4 py-3 font-medium">상태</th>
                <th className="px-4 py-3 font-medium">월 금액</th>
                <th className="px-4 py-3 font-medium">누적 결제</th>
                <th className="px-4 py-3 font-medium">결제 건수</th>
                <th className="px-4 py-3 font-medium">코호트</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f0f0]">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-[#fafafa]">
                  <td className="px-4 py-3">
                    <AdminLink href={`/admin/customers/${r.id}`} className="font-medium text-[#191919] hover:underline">
                      {r.name ?? '(이름 없음)'}
                    </AdminLink>
                    <div className="text-xs text-[#6b6b6b]">{r.email}</div>
                  </td>
                  <td className="px-4 py-3 text-xs">{r.subscriptionStatus ?? '—'}</td>
                  <td className="px-4 py-3">{r.amount != null ? `${r.amount.toLocaleString('ko-KR')}원` : '—'}</td>
                  <td className="px-4 py-3">{r.paidTotal.toLocaleString('ko-KR')}원</td>
                  <td className="px-4 py-3">{r.paymentCount}</td>
                  <td className="px-4 py-3 text-xs text-[#6b6b6b]">{r.cohortMonth ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#e7e7e7] bg-white p-4">
      <div className="text-xs text-[#6b6b6b]">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-[#191919]">{value}</div>
    </div>
  )
}

function RetentionCell({ r }: { r: number }) {
  const pct = Math.round(r * 100)
  const cls = pct >= 80 ? 'bg-emerald-100 text-emerald-700' : pct >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-[#f3f4f6] text-[#6b6b6b]'
  return <span className={`inline-flex min-w-11 justify-center rounded px-1.5 py-0.5 text-[11px] ${cls}`}>{pct}%</span>
}
