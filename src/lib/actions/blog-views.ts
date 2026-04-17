'use server'

// 블로그 글 view_count 증가 server action (T-010d)
// 클라이언트 컴포넌트에서 비동기 호출 (await 안 해도 됨, fire-and-forget OK).

import { getAdminClient } from '@/lib/supabase/admin-client'

const SLUG_PATTERN = /^[a-z0-9-]+$/

/**
 * blog_posts.view_count + 1.
 * 인증 불필요 (모든 방문자). bot 트래픽 필터링은 추후 분석 단계에서 처리.
 */
export async function incrementBlogPostView(slug: string): Promise<void> {
  if (!slug || !SLUG_PATTERN.test(slug) || slug.length > 100) return

  const supabase = getAdminClient()
  if (!supabase) return

  // RPC가 없으니 atomic increment 는 SQL 함수 추가 전까지 select+update 패턴 사용.
  // 동시성 race condition 은 view 통계 정확도가 절대값보다 추세가 중요하므로 허용.
  const { data: row } = await supabase
    .from('blog_posts')
    .select('view_count')
    .eq('slug', slug)
    .eq('status', 'active')
    .maybeSingle()
  if (!row) return

  await supabase
    .from('blog_posts')
    .update({ view_count: (row.view_count ?? 0) + 1 })
    .eq('slug', slug)
}
