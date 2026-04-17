#!/usr/bin/env tsx
/**
 * scripts/audit-related-content.ts (T-045)
 *
 * 각 place 에 대해 relatedBlogPosts 가 몇 개 연결되어 있는지 감사.
 * 닥터에버스 등 주요 업체에서 "관련 콘텐츠" 섹션이 비어 있는 이슈 조사.
 */
import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())

import { getAdminClient } from '../src/lib/supabase/admin-client'

interface PlaceRow { slug: string; name: string; category: string }
interface BlogRow { slug: string; title: string; related_place_slugs: string[] }

async function main() {
  const client = getAdminClient()!
  const { data: places } = await client
    .from('places')
    .select('slug, name, category')
    .order('created_at', { ascending: true })
  const { data: posts } = await client
    .from('blog_posts')
    .select('slug, title, related_place_slugs')
    .eq('status', 'active')

  const pp = (places ?? []) as PlaceRow[]
  const bp = (posts ?? []) as BlogRow[]
  console.log(`[audit] ${pp.length} places, ${bp.length} blog posts`)

  console.log('\n== 업체별 연결된 블로그 글 ==')
  for (const place of pp) {
    const linked = bp.filter(p => Array.isArray(p.related_place_slugs) && p.related_place_slugs.includes(place.slug))
    const marker = linked.length === 0 ? '⚠' : '·'
    console.log(`  ${marker} ${place.slug.padEnd(24)} (${place.name}) → ${linked.length}건`)
    for (const l of linked) {
      console.log(`      · ${l.title}`)
    }
  }

  console.log('\n== related_place_slugs 비어있는 블로그 글 ==')
  const orphan = bp.filter(p => !Array.isArray(p.related_place_slugs) || p.related_place_slugs.length === 0)
  console.log(`  ${orphan.length}/${bp.length}`)
  for (const p of orphan.slice(0, 20)) {
    console.log(`    · ${p.slug} — ${p.title}`)
  }
}

main().catch(err => {
  console.error('audit-related-content 치명적 오류:', err)
  process.exit(1)
})
