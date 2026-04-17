#!/usr/bin/env tsx
/**
 * scripts/audit-places.ts (T-041 / T-043)
 *
 * places 테이블 데이터 품질 감사.
 * 1) tags 필드가 string 으로 저장된 케이스 (array 여야 함)
 * 2) 자동생성 slug 패턴 (접미사 4자 랜덤 — 예: restaurant-6kty)
 *
 * 기본은 read-only. --fix-tags 플래그로 string tags 를 단일-원소 array 로 수정.
 */
import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())

import { getAdminClient } from '../src/lib/supabase/admin-client'

// 자동생성 슬러그: 접미사 4자리 영숫자 + 최소 1자리 숫자 포함.
// (순수 영단어 접미사는 정상 — "alive-skin" 등)
const AUTOSLUG_RE = /-[a-z0-9]{4}$/
function isAutoSlug(slug: string): boolean {
  if (!AUTOSLUG_RE.test(slug)) return false
  const suffix = slug.slice(-4)
  return /[0-9]/.test(suffix)
}

interface PlaceRow {
  id: string
  slug: string
  name: string
  category: string
  tags: unknown
}

async function main() {
  const fixTags = process.argv.includes('--fix-tags')
  const client = getAdminClient()
  if (!client) {
    console.error('admin client 초기화 실패')
    process.exit(1)
  }
  const { data, error } = await client
    .from('places')
    .select('id, slug, name, category, tags')
    .order('created_at', { ascending: true })
  if (error || !data) {
    console.error('places 조회 실패:', error?.message)
    process.exit(1)
  }
  const places = data as PlaceRow[]

  console.log(`[audit] 총 ${places.length} 곳`)

  // 1) tags 타입 감사
  const stringTagPlaces: PlaceRow[] = []
  const nullTagPlaces: PlaceRow[] = []
  for (const p of places) {
    if (p.tags == null) {
      nullTagPlaces.push(p)
    } else if (!Array.isArray(p.tags)) {
      stringTagPlaces.push(p)
    }
  }
  console.log(`\n== T-041 tags 점검 ==`)
  console.log(`  배열 아님: ${stringTagPlaces.length}`)
  for (const p of stringTagPlaces) {
    console.log(`    ! ${p.slug} — tags=${JSON.stringify(p.tags).slice(0, 80)}`)
  }
  console.log(`  null/undefined: ${nullTagPlaces.length}`)

  if (fixTags && stringTagPlaces.length > 0) {
    console.log('\n  --fix-tags: 단일 원소 배열로 변환 중...')
    for (const p of stringTagPlaces) {
      const fixed = typeof p.tags === 'string' ? [p.tags] : []
      const { error: upErr } = await (client.from('places') as ReturnType<typeof client.from>)
        .update({ tags: fixed } as never)
        .eq('id', p.id)
      if (upErr) console.error(`    ✗ ${p.slug}: ${upErr.message}`)
      else console.log(`    ✓ ${p.slug} → ${JSON.stringify(fixed)}`)
    }
  }

  // 2) 슬러그 패턴 감사
  console.log(`\n== T-043 slug 점검 ==`)
  const autoSlugs = places.filter(p => isAutoSlug(p.slug))
  if (autoSlugs.length === 0) {
    console.log('  자동생성 슬러그 없음')
  } else {
    console.log(`  자동생성 슬러그 ${autoSlugs.length}건:`)
    for (const p of autoSlugs) {
      const suggested = p.name
        .replace(/\(.*?\)/g, '')
        .replace(/\s+/g, '-')
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '')
        .slice(0, 40)
      console.log(`    · ${p.slug} (${p.name}) → 제안: "${suggested}"`)
    }
    console.log(
      '\n  ⚠ 슬러그 교체는 URL 변경이므로 301 redirect 도 next.config.ts 에 추가해야 합니다.',
    )
    console.log('  자동 수정은 제공하지 않음 — 수동 검토 후 admin/places 에서 교체 권장.')
  }
}

main().catch(err => {
  console.error('audit-places 치명적 오류:', err)
  process.exit(1)
})
