'use server'

// T-092 — 블로그 게시물 저장 + 발행 상태 변경.

import { requireAuthForAction } from '@/lib/auth'
import { getAdminClient } from '@/lib/supabase/admin-client'
import { revalidatePath } from 'next/cache'

export interface SaveBlogInput {
  slug: string
  title: string
  summary: string
  content: string
  category: string | null
  status: 'draft' | 'scheduled' | 'active' | 'archived'
  tags?: string[]
  publishedAt?: string | null
  targetQuery?: string | null
}

export async function saveBlogPost(input: SaveBlogInput): Promise<{ success: boolean; error?: string }> {
  await requireAuthForAction()
  const admin = getAdminClient()
  if (!admin) return { success: false, error: 'admin_unavailable' }
  if (!input.slug.trim() || !input.title.trim()) return { success: false, error: 'slug·title 필수' }

  const payload: Record<string, unknown> = {
    title: input.title.trim(),
    summary: input.summary.trim(),
    content: input.content,
    category: input.category,
    status: input.status,
    tags: input.tags ?? [],
    target_query: input.targetQuery ?? null,
    updated_at: new Date().toISOString(),
  }
  if (input.status === 'active' && input.publishedAt) {
    payload.published_at = input.publishedAt
  } else if (input.status === 'active') {
    payload.published_at = new Date().toISOString()
  }

  const { error } = await admin.from('blog_posts').update(payload).eq('slug', input.slug)
  if (error) return { success: false, error: error.message }

  revalidatePath('/admin/blog')
  revalidatePath(`/admin/blog/${input.slug}/edit`)
  revalidatePath(`/blog/${input.slug}`)
  revalidatePath('/blog')
  return { success: true }
}
