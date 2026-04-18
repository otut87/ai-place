// T-062 — /admin/review 검수 큐 v1 (업체만)
import { requireAuth } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'
import { parseReviewParams } from '@/lib/admin/review-queue'
import { ReviewQueueClient, type PendingPlace } from './review-queue-client'

export const dynamic = 'force-dynamic'

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireAuth()
  const raw = await searchParams
  const { placeId } = parseReviewParams(raw)

  const supabase = await createServerClient()
  const { data } = await supabase
    .from('places')
    .select('id, slug, name, city, category, description, services, faqs, tags, phone, rating, review_count, created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(100)

  const pending = (data ?? []) as unknown as PendingPlace[]

  return (
    <div className="flex h-[calc(100vh-3rem)]">
      <ReviewQueueClient pending={pending} initialPlaceId={placeId ?? null} />
    </div>
  )
}
