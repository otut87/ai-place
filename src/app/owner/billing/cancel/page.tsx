// T-174 — 구독 취소 페이지.
import { requireOwnerUser } from '@/lib/owner/auth'
import { getAdminClient } from '@/lib/supabase/admin-client'
import { CancelForm } from './cancel-form'
import Link from 'next/link'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export const metadata = {
  title: '구독 해지 — AI Place',
  robots: { index: false, follow: false },
}

export default async function CancelPage() {
  const user = await requireOwnerUser()
  const admin = getAdminClient()
  if (!admin) return <div className="p-10">admin unavailable</div>

  const { data: customer } = await admin
    .from('customers')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!customer) return <div className="p-10">customer 없음</div>

  const { data: sub } = await admin
    .from('subscriptions')
    .select('id, status, next_charge_at, created_at')
    .eq('customer_id', (customer as { id: string }).id)
    .in('status', ['active', 'past_due', 'pending_cancellation'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!sub) {
    return (
      <main className="mx-auto max-w-xl p-8">
        <h1 className="text-xl font-semibold">구독 해지</h1>
        <p className="mt-3 text-sm text-[#6a6a6a]">활성 구독이 없습니다.</p>
        <Link href="/owner" className="mt-4 inline-block text-sm text-[#008060] underline">← 내 업체로</Link>
      </main>
    )
  }

  const subRow = sub as { id: string; status: string; next_charge_at: string | null }

  return (
    <main className="mx-auto max-w-xl p-8">
      <h1 className="text-xl font-semibold">구독 해지</h1>
      <p className="mt-2 text-sm text-[#6a6a6a]">
        현재 구독 상태: <strong>{subRow.status}</strong>
      </p>
      {subRow.next_charge_at && (
        <p className="text-xs text-[#6a6a6a]">
          다음 결제 예정: {new Date(subRow.next_charge_at).toLocaleDateString('ko-KR')}
        </p>
      )}

      <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-medium">해지하시면:</p>
        <ul className="mt-2 space-y-1 text-xs">
          <li>✓ 업체 공개 페이지는 그대로 유지됩니다 (읽기 전용)</li>
          <li>✗ Owner 대시보드·주 1회 AI 인용 테스트·월간 리포트 중단</li>
          <li>✗ AI 자동 입력 기능 사용 불가</li>
        </ul>
      </div>

      <div className="mt-6">
        <CancelForm subscriptionId={subRow.id} nextChargeAt={subRow.next_charge_at} />
      </div>

      <Link href="/owner" className="mt-6 inline-block text-sm text-[#6a6a6a] underline">← 취소하지 않고 돌아가기</Link>
    </main>
  )
}
