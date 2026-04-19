// T-092 — 블로그 편집기 지원: 토픽 큐 + 내부링크 추천 + 마크다운 렌더.
// 원칙: blog_posts(004) 만 사용. 토픽 큐는 status='draft' 글을 가리킴.

import { getAdminClient } from '@/lib/supabase/admin-client'

export interface BlogTopicRow {
  id: string
  slug: string
  title: string
  summary: string
  category: string | null
  post_type: string
  created_at: string
  status: string
}

export async function listDraftTopics(limit = 50): Promise<BlogTopicRow[]> {
  const admin = getAdminClient()
  if (!admin) return []
  const { data } = await admin
    .from('blog_posts')
    .select('id, slug, title, summary, category, post_type, created_at, status')
    .eq('status', 'draft')
    .order('created_at', { ascending: false })
    .limit(limit)
  return (data ?? []) as BlogTopicRow[]
}

export interface BlogPostLoaded {
  id: string
  slug: string
  title: string
  summary: string
  content: string
  city: string
  sector: string
  category: string | null
  status: string
  post_type: string
  target_query: string | null
  tags: string[]
  published_at: string | null
  related_place_slugs: string[]
}

export async function loadBlogPostForEdit(slug: string): Promise<BlogPostLoaded | null> {
  const admin = getAdminClient()
  if (!admin) return null
  const { data } = await admin
    .from('blog_posts')
    .select('id, slug, title, summary, content, city, sector, category, status, post_type, target_query, tags, published_at, related_place_slugs')
    .eq('slug', slug)
    .maybeSingle()
  if (!data) return null
  // related_place_slugs null 방어
  const row = data as BlogPostLoaded
  return { ...row, related_place_slugs: row.related_place_slugs ?? [] }
}

/** 같은 city+category 의 active 업체를 체크박스 후보로 반환. */
export async function listPlacesForBlog(city: string, category: string | null): Promise<Array<{ slug: string; name: string; rating: number | null; reviewCount: number | null }>> {
  const admin = getAdminClient()
  if (!admin || !category) return []
  const { data } = await admin
    .from('places')
    .select('slug, name, rating, review_count')
    .eq('city', city)
    .eq('category', category)
    .eq('status', 'active')
    .order('rating', { ascending: false, nullsFirst: false })
    .order('review_count', { ascending: false, nullsFirst: false })
    .limit(20)
  return ((data ?? []) as Array<{ slug: string; name: string; rating: number | null; review_count: number | null }>).map(p => ({
    slug: p.slug,
    name: p.name,
    rating: p.rating,
    reviewCount: p.review_count,
  }))
}

/**
 * 내부링크 후보: 같은 카테고리의 다른 업체 slug + 같은 카테고리 다른 블로그.
 * content 에 아직 등장하지 않은 것만.
 */
export async function suggestInternalLinks(
  category: string | null,
  content: string,
  limit = 10,
): Promise<Array<{ kind: 'place' | 'blog'; slug: string; label: string; url: string }>> {
  const admin = getAdminClient()
  if (!admin || !category) return []

  const [places, blogs] = await Promise.all([
    admin.from('places').select('slug, name, city').eq('category', category).eq('status', 'active').limit(limit),
    admin.from('blog_posts').select('slug, title').eq('category', category).eq('status', 'active').limit(limit),
  ])

  const out: Array<{ kind: 'place' | 'blog'; slug: string; label: string; url: string }> = []

  for (const p of ((places.data ?? []) as Array<{ slug: string; name: string; city: string }>)) {
    if (!content.includes(p.slug)) {
      out.push({ kind: 'place', slug: p.slug, label: p.name, url: `/${p.city}/${category}/${p.slug}` })
    }
  }
  for (const b of ((blogs.data ?? []) as Array<{ slug: string; title: string }>)) {
    if (!content.includes(b.slug)) {
      out.push({ kind: 'blog', slug: b.slug, label: b.title, url: `/blog/${b.slug}` })
    }
  }

  return out.slice(0, limit)
}

/** 간단 마크다운 → HTML. 보안: script 태그 제거. */
export function renderMarkdown(md: string): string {
  let html = md
    // 코드블록 먼저 보호
    .replace(/```([\s\S]*?)```/g, (_, code) => `<pre><code>${escapeHtml(code as string)}</code></pre>`)
    // 헤딩
    .replace(/^######\s+(.+)$/gm, '<h6>$1</h6>')
    .replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>')
    .replace(/^####\s+(.+)$/gm, '<h4>$1</h4>')
    .replace(/^###\s+(.+)$/gm, '<h3>$1</h3>')
    .replace(/^##\s+(.+)$/gm, '<h2>$1</h2>')
    .replace(/^#\s+(.+)$/gm, '<h1>$1</h1>')
    // 볼드·이탤릭
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    // 링크
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    // 인라인 코드
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // 단락 (연속 빈 줄)
    .split(/\n{2,}/)
    .map(block => block.startsWith('<') ? block : `<p>${block.replace(/\n/g, '<br/>')}</p>`)
    .join('\n')

  // script 태그 및 on* 속성 제거 (단순 sanitization)
  html = html.replace(/<script[\s\S]*?<\/script>/gi, '')
  html = html.replace(/\son[a-z]+="[^"]*"/gi, '')
  return html
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
