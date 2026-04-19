// 설계안 §3.9 — 고객 상세: 빌링키 + 결제 이력 + 메모.

import { notFound } from 'next/navigation'
import { requireAuth } from '@/lib/auth'
import { getAdminClient } from '@/lib/supabase/admin-client'
import { AdminLink } from '@/components/admin/admin-link'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireAuth()
  const { id } = await params

  const admin = getAdminClient()
  if (!admin) return <div className="p-6 text-sm text-[#6b6b6b]">Admin 클라이언트 초기화 실패</div>

  const [customerRes, subsRes, keysRes, paysRes] = await Promise.all([
    admin.from('customers').select('id, name, email, phone, user_id, created_at').eq('id', id).maybeSingle(),
    admin.from('subscriptions').select('id, plan, amount, status, started_at, next_charge_at, canceled_at, cancel_reason, failed_retry_count').eq('customer_id', id),
    admin.from('billing_keys').select('id, provider, card_company, card_number_masked, expiry_year, expiry_month, status, authenticated_at, revoked_at').eq('customer_id', id),
    paymentHistoryForCustomer(admin, id),
  ])

  const customer = customerRes.data as { id: string; name: string | null; email: string; phone: string | null; user_id: string | null; created_at: string } | null
  if (!customer) return notFound()

  const subs = (subsRes.data ?? []) as Array<{ id: string; plan: string; amount: number; status: string; started_at: string | null; next_charge_at: string | null; canceled_at: string | null; cancel_reason: string | null; failed_retry_count: number }>
  const keys = (keysRes.data ?? []) as Array<{ id: string; provider: string; card_company: string | null; card_number_masked: string | null; expiry_year: number | null; expiry_month: number | null; status: string; authenticated_at: string; revoked_at: string | null }>

  const ltv = paysRes.filter(p => p.status === 'succeeded').reduce((a, p) => a + p.amount, 0)
  const successCount = paysRes.filter(p => p.status === 'succeeded').length
  const failCount = paysRes.filter(p => p.status === 'failed').length

  return (
    <div className="px-6 py-5">
      <AdminLink href="/admin/customers" className="mb-2 inline-block text-sm text-[#6b6b6b] hover:underline">← 고객 목록</AdminLink>
      <header className="mb-5">
        <h1 className="text-xl font-semibold">{customer.name ?? '(이름 없음)'}</h1>
        <p className="mt-1 text-sm text-[#6b6b6b]">{customer.email} {customer.phone ? `· ${customer.phone}` : ''}</p>
      </header>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="LTV" value={`${ltv.toLocaleString('ko-KR')}원`} />
        <Stat label="성공 결제" value={`${successCount}회`} />
        <Stat label="실패 결제" value={`${failCount}회`} />
        <Stat label="가입" value={new Date(customer.created_at).toLocaleDateString('ko-KR')} />
      </div>

      <Section title="구독">
        {subs.length === 0 ? (
          <Empty text="구독 없음" />
        ) : (
          <ul className="space-y-2">
            {subs.map(s => (
              <li key={s.id} className="flex items-center justify-between rounded-lg border border-[#e7e7e7] bg-white p-3 text-sm">
                <div>
                  <div className="font-medium">{s.plan} · {s.amount.toLocaleString('ko-KR')}원/월</div>
                  <div className="text-xs text-[#6b6b6b]">
                    다음 결제: {s.next_charge_at ? new Date(s.next_charge_at).toLocaleDateString('ko-KR') : '—'}
                    {s.failed_retry_count > 0 && ` · 실패 ${s.failed_retry_count}/3`}
                    {s.canceled_at && ` · 해지 ${new Date(s.canceled_at).toLocaleDateString('ko-KR')} (${s.cancel_reason ?? '사유 미기재'})`}
                  </div>
                </div>
                <StatusPill status={s.status} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="빌링키">
        {keys.length === 0 ? (
          <Empty text="등록된 카드 없음" />
        ) : (
          <ul className="space-y-2">
            {keys.map(k => (
              <li key={k.id} className="rounded-lg border border-[#e7e7e7] bg-white p-3 text-sm">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{k.card_company ?? k.provider} {k.card_number_masked ?? ''}</div>
                  <StatusPill status={k.status} />
                </div>
                <div className="mt-1 text-xs text-[#6b6b6b]">
                  만료: {k.expiry_year && k.expiry_month ? `${k.expiry_year}-${String(k.expiry_month).padStart(2, '0')}` : '—'}
                  {' · 인증: '}
                  {new Date(k.authenticated_at).toLocaleDateString('ko-KR')}
                  {k.revoked_at && ` · 해지 ${new Date(k.revoked_at).toLocaleDateString('ko-KR')}`}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="최근 결제 이력">
        {paysRes.length === 0 ? (
          <Empty text="결제 이력 없음" />
        ) : (
          <div className="overflow-hidden rounded-lg border border-[#e7e7e7] bg-white">
            <table className="w-full text-sm">
              <thead className="bg-[#fafafa] text-left text-xs uppercase tracking-wider text-[#6b6b6b]">
                <tr>
                  <th className="px-4 py-2 font-medium">시각</th>
                  <th className="px-4 py-2 font-medium">상태</th>
                  <th className="px-4 py-2 font-medium">금액</th>
                  <th className="px-4 py-2 font-medium">주문 ID</th>
                  <th className="px-4 py-2 font-medium">메시지</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0f0f0]">
                {paysRes.slice(0, 20).map(p => (
                  <tr key={p.id}>
                    <td className="px-4 py-2 text-xs text-[#6b6b6b]">{new Date(p.attempted_at).toLocaleString('ko-KR')}</td>
                    <td className="px-4 py-2"><StatusPill status={p.status} /></td>
                    <td className="px-4 py-2">{p.amount.toLocaleString('ko-KR')}원</td>
                    <td className="px-4 py-2 font-mono text-xs">{p.pg_order_id}</td>
                    <td className="px-4 py-2 text-xs text-[#6b6b6b]">{p.pg_response_message ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  )
}

async function paymentHistoryForCustomer(admin: NonNullable<ReturnType<typeof getAdminClient>>, customerId: string) {
  const { data: subs } = await admin.from('subscriptions').select('id').eq('customer_id', customerId)
  const ids = ((subs ?? []) as Array<{ id: string }>).map(s => s.id)
  if (ids.length === 0) return [] as Array<{ id: string; amount: number; status: string; pg_order_id: string; pg_response_message: string | null; attempted_at: string }>
  const { data } = await admin
    .from('payments')
    .select('id, amount, status, pg_order_id, pg_response_message, attempted_at')
    .in('subscription_id', ids)
    .order('attempted_at', { ascending: false })
    .limit(50)
  return (data ?? []) as Array<{ id: string; amount: number; status: string; pg_order_id: string; pg_response_message: string | null; attempted_at: string }>
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#e7e7e7] bg-white p-4">
      <div className="text-xs text-[#6b6b6b]">{label}</div>
      <div className="mt-1 text-xl font-semibold text-[#191919]">{value}</div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-sm font-semibold text-[#191919]">{title}</h2>
      {children}
    </section>
  )
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-lg border border-[#e7e7e7] bg-white p-6 text-center text-sm text-[#6b6b6b]">{text}</div>
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    past_due: 'bg-amber-50 text-amber-700 border-amber-200',
    suspended: 'bg-red-50 text-red-700 border-red-200',
    canceled: 'bg-[#f3f4f6] text-[#6b6b6b] border-[#e7e7e7]',
    pending: 'bg-sky-50 text-sky-700 border-sky-200',
    succeeded: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    failed: 'bg-red-50 text-red-700 border-red-200',
    revoked: 'bg-[#f3f4f6] text-[#6b6b6b] border-[#e7e7e7]',
    expired: 'bg-amber-50 text-amber-700 border-amber-200',
  }
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] ${map[status] ?? 'bg-[#f3f4f6] text-[#6b6b6b] border-[#e7e7e7]'}`}>
      {status}
    </span>
  )
}
