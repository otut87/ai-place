// T-062 + T-093 — /admin/review 검수 큐: 업체 / 블로그 타입 탭.
import { requireAuth } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'
import { parseReviewParams } from '@/lib/admin/review-queue'
import { AdminLink } from '@/components/admin/admin-link'
import { ReviewQueueClient, type PendingPlace } from './review-queue-client'
import { BlogReviewQueueClient, type PendingBlogPost } from './blog-review-queue-client'

export const dynamic = 'force-dynamic'

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireAuth()
  const raw = await searchParams
  const { type, placeId, blogSlug } = parseReviewParams(raw)

  const supabase = await createServerClient()

  return (
    <div className="flex h-[calc(100vh-3rem)] flex-col">
      <nav className="flex items-center gap-1 border-b border-[#e7e7e7] bg-white px-5 py-2">
        <Tab href="/admin/review?type=place" active={type === 'place'}>업체</Tab>
        <Tab href="/admin/review?type=blog" active={type === 'blog'}>블로그</Tab>
      </nav>

      {type === 'place' ? (
        <PlaceReviewPane supabase={supabase} initialPlaceId={placeId ?? null} />
      ) : (
        <BlogReviewPane supabase={supabase} initialBlogSlug={blogSlug ?? null} />
      )}
    </div>
  )
}

async function PlaceReviewPane({
  supabase,
  initialPlaceId,
}: {
  supabase: Awaited<ReturnType<typeof createServerClient>>
  initialPlaceId: string | null
}) {
  const { data } = await supabase
    .from('places')
    .select('id, slug, name, city, category, description, services, faqs, tags, phone, rating, review_count, created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(100)
  const pending = (data ?? []) as unknown as PendingPlace[]

  return (
    <div className="flex min-h-0 flex-1">
      <ReviewQueueClient pending={pending} initialPlaceId={initialPlaceId} />
    </div>
  )
}

async function BlogReviewPane({
  supabase,
  initialBlogSlug,
}: {
  supabase: Awaited<ReturnType<typeof createServerClient>>
  initialBlogSlug: string | null
}) {
  const { data } = await supabase
    .from('blog_posts')
    .select('id, slug, title, summary, content, category, post_type, tags, created_at')
    .eq('status', 'draft')
    .order('created_at', { ascending: false })
    .limit(100)
  const pending = (data ?? []) as unknown as PendingBlogPost[]

  return (
    <div className="flex min-h-0 flex-1">
      <BlogReviewQueueClient pending={pending} initialBlogSlug={initialBlogSlug} />
    </div>
  )
}

function Tab({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <AdminLink
      href={href}
      className={`rounded-md px-3 py-1.5 text-sm ${
        active ? 'bg-[#191919] text-white' : 'text-[#6b6b6b] hover:bg-[#f3f4f6]'
      }`}
    >
      {children}
    </AdminLink>
  )
}
