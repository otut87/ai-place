// places 테이블 owner identity coverage 진단 (T-259 Phase 0 사전 작업).
// owner_id / owner_email / customer_id 채워진 active places 비율 + orphan 리스트.
// 향후 권한 모델 변경 / unclaimed 업체 마이그레이션 검토 시 재사용 가능.
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env.local' })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing Supabase env')
  process.exit(1)
}

const sb = createClient(url, key, { auth: { persistSession: false } })

async function main() {
  const { data, error } = await sb
    .from('places')
    .select('id, slug, name, status, owner_id, owner_email, customer_id')
  if (error) {
    console.error('query failed:', error)
    process.exit(1)
  }
  type Row = { id: string; slug: string; name: string; status: string;
    owner_id: string | null; owner_email: string | null; customer_id: string | null }
  const rows = (data ?? []) as Row[]

  const buckets = {
    total: rows.length,
    active: 0,
    archived: 0,
    pending: 0,
    other: 0,
    activeWithOwnerId: 0,
    activeWithOwnerEmail: 0,
    activeWithCustomerId: 0,
    activeWithAny: 0,
    activeWithNone: 0,
    activeWithCustomerOnly: 0,
  }
  const orphans: Row[] = []

  for (const r of rows) {
    if (r.status === 'active') buckets.active++
    else if (r.status === 'archived') buckets.archived++
    else if (r.status === 'pending') buckets.pending++
    else buckets.other++

    if (r.status !== 'active') continue
    const hasOwnerId = !!r.owner_id
    const hasOwnerEmail = !!r.owner_email
    const hasCustomerId = !!r.customer_id

    if (hasOwnerId) buckets.activeWithOwnerId++
    if (hasOwnerEmail) buckets.activeWithOwnerEmail++
    if (hasCustomerId) buckets.activeWithCustomerId++
    if (hasOwnerId || hasOwnerEmail || hasCustomerId) buckets.activeWithAny++
    if (!hasOwnerId && !hasOwnerEmail && !hasCustomerId) {
      buckets.activeWithNone++
      orphans.push(r)
    }
    if (!hasOwnerId && !hasOwnerEmail && hasCustomerId) buckets.activeWithCustomerOnly++
  }

  console.log(JSON.stringify(buckets, null, 2))
  if (orphans.length > 0) {
    console.log('\n--- ACTIVE PLACES WITH NO OWNER SIGNAL (will be inaccessible after canOwnerEdit unification) ---')
    for (const o of orphans.slice(0, 30)) {
      console.log(`  ${o.id}  ${o.status}  ${o.slug}  ${o.name}`)
    }
    if (orphans.length > 30) console.log(`  ... and ${orphans.length - 30} more`)
  }
  if (buckets.activeWithCustomerOnly > 0) {
    console.log(`\n--- ACTIVE PLACES WITH ONLY customer_id (no owner_id, no owner_email) ---`)
    console.log(`count: ${buckets.activeWithCustomerOnly}`)
    console.log('이 row들은 canOwnerEdit() 통일 시 owner UI에서 안 보임. 별도 마이그레이션 필요할 수 있음.')
  }
}

main().catch(e => { console.error(e); process.exit(1) })
