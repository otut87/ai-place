// T-092 — /admin/blog/[slug]/edit — 마크다운 + 프리뷰 분할 편집기.

import { notFound } from 'next/navigation'
import { requireAuth } from '@/lib/auth'
import { loadBlogPostForEdit, suggestInternalLinks } from '@/lib/admin/blog-editor'
import { BlogEditorClient } from './editor-client'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default async function BlogEditPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  await requireAuth()
  const { slug } = await params
  const post = await loadBlogPostForEdit(slug)
  if (!post) return notFound()

  const linkSuggestions = await suggestInternalLinks(post.category, post.content, 10)

  return (
    <BlogEditorClient
      post={post}
      suggestions={linkSuggestions}
    />
  )
}
