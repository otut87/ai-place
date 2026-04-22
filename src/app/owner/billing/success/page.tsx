// Sprint O-1 / T-204 — Toss 빌링 인증 성공 콜백.
// redirect 흐름:
//   TossPayments → /owner/billing/success?authKey=xxx&customerKey=yyy
//   → issueBillingKeyAction(authKey, customerKey) 서버 액션
//   → 성공: /owner/billing?success=1
//   → 실패: /owner/billing?code=xxx&message=yyy

import { redirect } from 'next/navigation'
import { requireOwnerUser } from '@/lib/owner/auth'
import { issueBillingKeyAction } from '@/lib/actions/owner-billing'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface Params {
  searchParams: Promise<{ authKey?: string; customerKey?: string }>
}

export default async function BillingSuccessPage({ searchParams }: Params) {
  await requireOwnerUser('/owner/billing')
  const { authKey, customerKey } = await searchParams

  if (!authKey || !customerKey) {
    redirect('/owner/billing?code=missing_params&message=' + encodeURIComponent('Toss 응답 파라미터가 부족합니다.'))
  }

  const result = await issueBillingKeyAction({ authKey, customerKey })

  if (!result.success) {
    redirect('/owner/billing?code=issue_failed&message=' + encodeURIComponent(result.error))
  }

  redirect('/owner/billing?success=1')
}
