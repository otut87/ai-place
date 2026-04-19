'use server'

// T-093 — 블로그 승인/반려 액션.

import { requireAuthForAction } from '@/lib/auth'
import { getAdminClient } from '@/lib/supabase/admin-client'
import { revalidatePath } from 'next/cache'
import { isRejectReason, type RejectReason } from '@/lib/admin/review-queue'

export async function approveBlogPost(slug: string): Promise<{ success: boolean; error?: string }> {
  await requireAuthForAction()
  if (!slug) return { success: false, error: 'slug 필수' }
  const admin = getAdminClient()
  if (!admin) return { success: false, error: 'admin_unavailable' }

  const { error } = await admin
    .from('blog_posts')
    .update({ status: 'active', published_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('slug', slug)
  if (error) return { success: false, error: error.message }

  revalidatePath('/admin/review')
  revalidatePath('/admin/blog')
  revalidatePath(`/blog/${slug}`)
  revalidatePath('/blog')
  return { success: true }
}

export interface RejectBlogInput {
  slug: string
  reason: RejectReason
  note?: string
}

export async function rejectBlogPost({ slug, reason, note }: RejectBlogInput): Promise<{ success: boolean; error?: string }> {
  await requireAuthForAction()
  if (!slug) return { success: false, error: 'slug 필수' }
  if (!isRejectReason(reason)) return { success: false, error: '허용되지 않은 반려 사유' }
  const admin = getAdminClient()
  if (!admin) return { success: false, error: 'admin_unavailable' }

  // 블로그는 archived 로 이동. 반려 사유는 별도 테이블이 없어 로그로만 남기고
  // summary 에 prefix 는 달지 않음 (데이터 오염 방지).
  const { error } = await admin
    .from('blog_posts')
    .update({ status: 'archived', updated_at: new Date().toISOString() })
    .eq('slug', slug)
  if (error) return { success: false, error: error.message }

  // 간단 감사 로그 (console) — 별도 테이블 없음. 추후 blog_audit_log 추가 시 교체.
  console.info('[blog-reject]', { slug, reason, note })

  revalidatePath('/admin/review')
  revalidatePath('/admin/blog')
  return { success: true }
}
