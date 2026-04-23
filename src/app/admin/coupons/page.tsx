// T-229 — /admin/coupons — 쿠폰 발급/통계 페이지.
// 테이블: code · 할인 · 유효기간 · 사용 현황 · 상태 · 액션(비활성화)

import { requireAuth } from '@/lib/auth'
import { getAdminClient } from '@/lib/supabase/admin-client'
import { CouponCreateForm } from './create-form'
import { DeactivateButton } from './deactivate-button'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface CouponRow {
  id: string
  code: string
  discount_type: 'percent' | 'fixed'
  discount_value: number
  valid_from: string
  valid_until: string | null
  max_uses: number | null
  uses_count: number
  note: string | null
  created_at: string
}

function discountLabel(type: 'percent' | 'fixed', value: number): string {
  return type === 'percent' ? `${value}%` : `₩${value.toLocaleString('ko-KR')}`
}

function statusOf(row: CouponRow): { label: string; tone: string } {
  const now = Date.now()
  if (row.valid_until && Date.parse(row.valid_until) < now) return { label: '만료', tone: '#9a2c00' }
  if (row.max_uses != null && row.uses_count >= row.max_uses) return { label: '소진', tone: '#9a2c00' }
  if (Date.parse(row.valid_from) > now) return { label: '대기', tone: '#6b6b6b' }
  return { label: '활성', tone: '#047857' }
}

export default async function AdminCouponsPage() {
  await requireAuth()
  const admin = getAdminClient()

  const { data: rawRows } = admin
    ? await admin
        .from('coupons')
        .select('id, code, discount_type, discount_value, valid_from, valid_until, max_uses, uses_count, note, created_at')
        .order('created_at', { ascending: false })
        .limit(200)
    : { data: [] }
  const rows = (rawRows ?? []) as CouponRow[]

  const totalUses = rows.reduce((s, r) => s + r.uses_count, 0)
  const activeCount = rows.filter((r) => statusOf(r).label === '활성').length

  return (
    <div className="px-6 py-5">
      <header className="mb-5 flex items-baseline justify-between">
        <div>
          <h1 className="text-xl font-semibold">쿠폰 관리</h1>
          <p className="mt-1 text-sm text-[#6b6b6b]">
            percent (%) 또는 fixed (원) 할인. 1 customer × 1 coupon. 스태킹 금지.
          </p>
        </div>
        <div className="text-xs text-[#6b6b6b]">
          활성 {activeCount} · 누적 사용 {totalUses}
        </div>
      </header>

      <section className="mb-5">
        <CouponCreateForm />
      </section>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-[#e7e7e7] bg-white p-10 text-center text-sm text-[#6b6b6b]">
          등록된 쿠폰이 없습니다.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[#e7e7e7] bg-white">
          <table className="w-full text-sm">
            <thead className="bg-[#fafafa] text-left text-xs uppercase tracking-wider text-[#6b6b6b]">
              <tr>
                <th className="px-4 py-3 font-medium">코드</th>
                <th className="px-4 py-3 font-medium">할인</th>
                <th className="px-4 py-3 font-medium">유효기간</th>
                <th className="px-4 py-3 font-medium">사용</th>
                <th className="px-4 py-3 font-medium">메모</th>
                <th className="px-4 py-3 font-medium">상태</th>
                <th className="px-4 py-3 font-medium">액션</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const st = statusOf(r)
                return (
                  <tr key={r.id} className="border-t border-[#f0f0f0]">
                    <td className="px-4 py-3 font-mono text-[13px]">{r.code}</td>
                    <td className="px-4 py-3">{discountLabel(r.discount_type, r.discount_value)}</td>
                    <td className="px-4 py-3 text-[12px] text-[#6b6b6b]">
                      {r.valid_until ? `~ ${r.valid_until.slice(0, 10)}` : '무제한'}
                    </td>
                    <td className="px-4 py-3 font-mono text-[12px]">
                      {r.uses_count}{r.max_uses != null ? ` / ${r.max_uses}` : ' / ∞'}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-[#6b6b6b]">{r.note ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span style={{ color: st.tone, fontSize: 12, fontWeight: 500 }}>{st.label}</span>
                    </td>
                    <td className="px-4 py-3">
                      {st.label === '활성' && <DeactivateButton couponId={r.id} code={r.code} />}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
