// 설계안 §3.10 — 결제 이력 전체 검색.

import { requireAuth } from '@/lib/auth'
import { listPaymentHistory } from '@/lib/admin/billing-queries'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default async function BillingHistoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireAuth()
  const raw = await searchParams
  const status = asSingle(raw.status) ?? 'all'
  const search = asSingle(raw.q) ?? ''

  const rows = await listPaymentHistory({
    status: isStatus(status) ? status : 'all',
    search: search || undefined,
    limit: 100,
  })

  return (
    <div className="px-6 py-5">
      <header className="mb-5">
        <h1 className="text-xl font-semibold">결제 이력</h1>
        <p className="mt-1 text-sm text-[#6b6b6b]">승인·실패·취소 전체 이력 (최근 100건).</p>
      </header>

      <form method="get" className="mb-4 flex items-center gap-2 text-sm">
        <select name="status" defaultValue={status} className="h-9 rounded-md border border-[#e7e7e7] bg-white px-2">
          <option value="all">전체</option>
          <option value="succeeded">성공</option>
          <option value="failed">실패</option>
          <option value="canceled">취소</option>
        </select>
        <input
          type="text"
          name="q"
          defaultValue={search}
          placeholder="주문 ID (ord_...)"
          className="h-9 rounded-md border border-[#e7e7e7] bg-white px-2"
        />
        <button type="submit" className="h-9 rounded-md bg-[#191919] px-3 text-white">적용</button>
      </form>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-[#e7e7e7] bg-white p-10 text-center text-sm text-[#6b6b6b]">결과 없음</div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[#e7e7e7] bg-white">
          <table className="w-full text-sm">
            <thead className="bg-[#fafafa] text-left text-xs uppercase tracking-wider text-[#6b6b6b]">
              <tr>
                <th className="px-4 py-3 font-medium">시각</th>
                <th className="px-4 py-3 font-medium">고객</th>
                <th className="px-4 py-3 font-medium">금액</th>
                <th className="px-4 py-3 font-medium">상태</th>
                <th className="px-4 py-3 font-medium">주문 ID</th>
                <th className="px-4 py-3 font-medium">재시도</th>
                <th className="px-4 py-3 font-medium">메시지</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f0f0]">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 text-xs text-[#6b6b6b]">{new Date(r.attemptedAt).toLocaleString('ko-KR')}</td>
                  <td className="px-4 py-3">
                    <div className="text-[#191919]">{r.customerName ?? '—'}</div>
                    <div className="text-xs text-[#6b6b6b]">{r.customerEmail ?? '—'}</div>
                  </td>
                  <td className="px-4 py-3">{r.amount.toLocaleString('ko-KR')}원</td>
                  <td className="px-4 py-3"><StatusPill status={r.status} /></td>
                  <td className="px-4 py-3 font-mono text-xs">{r.pgOrderId}</td>
                  <td className="px-4 py-3 text-xs">{r.retriedCount}</td>
                  <td className="px-4 py-3 text-xs text-[#6b6b6b]">{r.pgResponseMessage ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    succeeded: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    failed: 'bg-red-50 text-red-700 border-red-200',
    canceled: 'bg-[#f3f4f6] text-[#6b6b6b] border-[#e7e7e7]',
  }
  const label: Record<string, string> = { succeeded: '성공', failed: '실패', canceled: '취소' }
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${map[status] ?? 'bg-[#f3f4f6] text-[#6b6b6b] border-[#e7e7e7]'}`}>
      {label[status] ?? status}
    </span>
  )
}

function asSingle(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v
}

function isStatus(v: string): v is 'succeeded' | 'failed' | 'canceled' | 'all' {
  return ['succeeded', 'failed', 'canceled', 'all'].includes(v)
}
