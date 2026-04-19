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
  relatedPlaceSlugs?: string[]
}

export async function saveBlogPost(input: SaveBlogInput): Promise<{ success: boolean; error?: string }> {
  await requireAuthForAction()
  const admin = getAdminClient()
  if (!admin) return { success: false, error: 'admin_unavailable' }
  if (!input.slug.trim() || !input.title.trim()) return { success: false, error: 'slug·title 필수' }

  // DB check 제약: status in ('draft', 'active', 'archived')
  // 'scheduled' 상태는 status='draft' + published_at(미래 날짜) 조합으로 저장.
  const dbStatus = input.status === 'scheduled' ? 'draft' : input.status
  const payload: Record<string, unknown> = {
    title: input.title.trim(),
    summary: input.summary.trim(),
    content: input.content,
    category: input.category,
    status: dbStatus,
    tags: input.tags ?? [],
    target_query: input.targetQuery ?? null,
    related_place_slugs: input.relatedPlaceSlugs ?? [],
    updated_at: new Date().toISOString(),
  }
  if (input.status === 'active' && input.publishedAt) {
    payload.published_at = input.publishedAt
  } else if (input.status === 'active') {
    payload.published_at = new Date().toISOString()
  } else if (input.status === 'scheduled' && input.publishedAt) {
    payload.published_at = input.publishedAt
  }

  const { error } = await admin.from('blog_posts').update(payload).eq('slug', input.slug)
  if (error) return { success: false, error: error.message }

  revalidatePath('/admin/blog')
  revalidatePath(`/admin/blog/${input.slug}/edit`)
  revalidatePath(`/blog/${input.slug}`)
  revalidatePath('/blog')
  return { success: true }
}

// T-128 — 블로그 글 삭제 (archive 가 아닌 진짜 DB 행 삭제).
export async function deleteBlogPost(slug: string): Promise<{ success: boolean; error?: string }> {
  await requireAuthForAction()
  const admin = getAdminClient()
  if (!admin) return { success: false, error: 'admin_unavailable' }
  if (!slug.trim()) return { success: false, error: 'slug 필수' }
  const { error } = await admin.from('blog_posts').delete().eq('slug', slug)
  if (error) return { success: false, error: error.message }
  revalidatePath('/admin/blog')
  revalidatePath('/blog')
  return { success: true }
}

// T-128 — 블로그 캘린더에서 "+ 새 토픽" 생성.
export interface CreateBlogTopicInput {
  title: string
  city: string
  sector: string
  category?: string | null
  postType: 'keyword' | 'compare' | 'guide' | 'general'
  scheduledDate?: string | null   // YYYY-MM-DD 형식
}

export async function createBlogTopic(
  input: CreateBlogTopicInput,
): Promise<{ success: true; slug: string } | { success: false; error: string }> {
  await requireAuthForAction()
  const admin = getAdminClient()
  if (!admin) return { success: false, error: 'admin_unavailable' }

  const title = input.title.trim()
  if (!title) return { success: false, error: '제목 필수' }
  if (!input.city.trim() || !input.sector.trim()) return { success: false, error: 'city·sector 필수' }

  // slug 생성 — ASCII only (공개 라우트의 SLUG_PATTERN=/^[a-z0-9-]+$/ 통과 필수).
  // city + sector + postType + 3글자 랜덤을 기본값으로 하되,
  // 제목에 영숫자 단어가 있으면 일부 반영.
  const cityPart = input.city.trim().toLowerCase().replace(/[^a-z0-9]/g, '') || 'post'
  const sectorPart = input.sector.trim().toLowerCase().replace(/[^a-z0-9]/g, '') || input.postType
  const asciiFromTitle = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 30)
  const suffix = Math.random().toString(36).slice(2, 6).replace(/[^a-z0-9]/g, '').padEnd(4, 'x')
  const slug = [cityPart, sectorPart, asciiFromTitle || undefined, suffix]
    .filter(Boolean)
    .join('-')
    .replace(/-+/g, '-')

  // DB check 제약: status in ('draft', 'active', 'archived')
  // 'scheduled' 은 draft + published_at(미래 날짜) 로 표현.
  const payload = {
    slug,
    title,
    summary: '',
    content: '',
    city: input.city.trim(),
    sector: input.sector.trim(),
    category: input.category ?? null,
    post_type: input.postType,
    tags: [] as string[],
    status: 'draft',
    published_at: input.scheduledDate ? new Date(input.scheduledDate).toISOString() : null,
  }

  const { error } = await admin.from('blog_posts').insert(payload)
  if (error) return { success: false, error: error.message }

  revalidatePath('/admin/blog')
  return { success: true, slug }
}
