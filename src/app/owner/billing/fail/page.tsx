// Sprint O-1 / T-204 — Toss 빌링 인증 실패 콜백.
// redirect 흐름: Toss → /owner/billing/fail?code=xxx&message=yyy
//   → /owner/billing?code=xxx&message=yyy

import { redirect } from 'next/navigation'
import { requireOwnerUser } from '@/lib/owner/auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface Params {
  searchParams: Promise<{ code?: string; message?: string }>
}

export default async function BillingFailPage({ searchParams }: Params) {
  await requireOwnerUser('/owner/billing')
  const { code, message } = await searchParams
  const q = new URLSearchParams({
    code: code ?? 'unknown',
    message: message ?? '카드 인증이 취소되거나 실패했습니다.',
  })
  redirect(`/owner/billing?${q.toString()}`)
}
