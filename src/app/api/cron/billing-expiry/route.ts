// T-074 — 카드 만료 임박 Cron.
// Vercel Cron 에서 매일 1회 호출 (vercel.json).
// Authorization: Bearer $VERCEL_CRON_SECRET 만 허용.

import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin-client'
import { daysUntilCardExpiry, warningDayForToday, type ExpiryCandidate } from '@/lib/billing/expiry'
import { dispatchNotify } from '@/lib/actions/notify'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const secret = process.env.VERCEL_CRON_SECRET
  const auth = req.headers.get('authorization') ?? ''
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const admin = getAdminClient()
  if (!admin) return NextResponse.json({ error: 'admin_unavailable' }, { status: 500 })

  const { data, error } = await admin
    .from('billing_keys')
    .select(`
      id, customer_id, card_company, card_number_masked, expiry_year, expiry_month,
      customers:customer_id ( name, email )
    `)
    .eq('status', 'active')

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'query_failed' }, { status: 500 })
  }

  const now = new Date()
  const candidates: ExpiryCandidate[] = []
  for (const row of data as unknown as Array<{
    id: string
    customer_id: string
    card_company: string | null
    card_number_masked: string | null
    expiry_year: number | null
    expiry_month: number | null
    customers: { name: string | null; email: string | null } | null
  }>) {
    const daysLeft = daysUntilCardExpiry({ expiry_year: row.expiry_year, expiry_month: row.expiry_month }, now)
    if (daysLeft === null) continue
    const warning = warningDayForToday(daysLeft)
    if (!warning) continue
    if (!row.customers?.email) continue
    candidates.push({
      billingKeyId: row.id,
      customerId: row.customer_id,
      customerName: row.customers.name,
      customerEmail: row.customers.email,
      cardCompany: row.card_company,
      cardNumberMasked: row.card_number_masked,
      daysLeft,
      warningDay: warning,
    })
  }

  let sent = 0
  for (const c of candidates) {
    await dispatchNotify({
      type: 'billing.expiry_warning',
      customerName: c.customerName ?? '(이름 없음)',
      customerEmail: c.customerEmail!,
      cardCompany: c.cardCompany,
      cardNumberMasked: c.cardNumberMasked,
      daysUntilExpiry: c.warningDay,
    })
    sent += 1
  }

  return NextResponse.json({ ok: true, sent, scanned: data.length })
}
