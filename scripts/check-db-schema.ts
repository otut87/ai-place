#!/usr/bin/env tsx
/**
 * scripts/check-db-schema.ts
 *
 * 로컬 마이그레이션 파일과 실제 Supabase DB 스키마를 대조.
 * 각 probe 결과를 개별 출력 → 부분 적용 상태 진단.
 */
import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())

import { getAdminClient } from '../src/lib/supabase/admin-client'

type Probe =
  | { kind: 'table'; table: string }
  | { kind: 'column'; table: string; column: string }

type ProbeResult = { probe: Probe; present: boolean; note?: string }

const MIGRATIONS: Array<{ id: string; probes: Probe[] }> = [
  { id: '001_initial_schema', probes: [{ kind: 'table', table: 'places' }] },
  { id: '002_add_google_fields', probes: [{ kind: 'column', table: 'places', column: 'google_place_id' }] },
  { id: '003_cities_categories_registration', probes: [{ kind: 'table', table: 'cities' }, { kind: 'table', table: 'categories' }] },
  { id: '004_blog_posts', probes: [{ kind: 'table', table: 'blog_posts' }] },
  { id: '007_recommendation_fields', probes: [
    { kind: 'column', table: 'places', column: 'recommended_for' },
    { kind: 'column', table: 'places', column: 'strengths' },
    { kind: 'column', table: 'places', column: 'place_type' },
    { kind: 'column', table: 'places', column: 'recommendation_note' },
  ] },
  { id: '009_sectors_and_category_sector', probes: [{ kind: 'table', table: 'sectors' }, { kind: 'column', table: 'categories', column: 'sector' }] },
  { id: '011_blog_posts_extend', probes: [{ kind: 'column', table: 'blog_posts', column: 'quality_score' }] },
  { id: '012_places_external_ids', probes: [{ kind: 'column', table: 'places', column: 'kakao_place_id' }] },
  { id: '013_ai_generations', probes: [{ kind: 'table', table: 'ai_generations' }, { kind: 'column', table: 'places', column: 'quality_score' }] },
  { id: '014_places_images_storage', probes: [{ kind: 'column', table: 'places', column: 'images' }] },
  { id: '015_place_audit_log', probes: [{ kind: 'table', table: 'place_audit_log' }] },
  { id: '016_citation_results', probes: [{ kind: 'table', table: 'citation_results' }] },
  { id: '017_place_owner_email', probes: [{ kind: 'column', table: 'places', column: 'owner_email' }] },
  { id: '018_audit_actor_type', probes: [{ kind: 'column', table: 'place_audit_log', column: 'actor_type' }] },
  { id: '019_place_field_meta', probes: [{ kind: 'column', table: 'places', column: 'field_meta' }] },
  { id: '020_billing', probes: [
    { kind: 'table', table: 'customers' },
    { kind: 'table', table: 'billing_keys' },
    { kind: 'table', table: 'subscriptions' },
    { kind: 'table', table: 'payments' },
    { kind: 'column', table: 'places', column: 'customer_id' },
  ] },
  { id: '021_pipeline_jobs', probes: [{ kind: 'table', table: 'pipeline_jobs' }] },
  { id: '022_prompt_templates', probes: [{ kind: 'table', table: 'prompt_templates' }] },
  { id: '023_autopublish_policy', probes: [{ kind: 'table', table: 'autopublish_policy' }] },
  { id: '024_bot_visits', probes: [{ kind: 'table', table: 'bot_visits' }] },
]

async function probeTable(supabase: ReturnType<typeof getAdminClient>, table: string): Promise<ProbeResult['present'] | 'unknown'> {
  if (!supabase) return 'unknown'
  const { error } = await supabase.from(table).select('*', { count: 'exact', head: true })
  if (!error) return true
  if (error.code === '42P01' || /does not exist/.test(error.message)) return false
  // RLS / 권한 에러는 테이블 존재로 간주
  return true
}

async function probeColumn(supabase: ReturnType<typeof getAdminClient>, table: string, column: string): Promise<ProbeResult['present'] | 'unknown'> {
  if (!supabase) return 'unknown'
  // head:true 는 SELECT 표현식을 검증하지 않으므로 실제 limit(1) 쿼리 사용.
  const { error } = await supabase.from(table).select(column).limit(1)
  if (!error) return true
  if (error.code === '42P01') return false
  if (error.code === '42703') return false
  return true
}

async function runProbe(supabase: ReturnType<typeof getAdminClient>, p: Probe): Promise<ProbeResult> {
  const present = p.kind === 'table' ? await probeTable(supabase, p.table) : await probeColumn(supabase, p.table, p.column)
  return { probe: p, present: present === 'unknown' ? false : present, note: present === 'unknown' ? 'unknown' : undefined }
}

function formatProbe(p: Probe): string {
  return p.kind === 'table' ? `table "${p.table}"` : `${p.table}.${p.column}`
}

async function main() {
  const supabase = getAdminClient()
  if (!supabase) {
    console.error('❌ Supabase admin client 생성 실패 — SUPABASE_SERVICE_ROLE_KEY 확인')
    process.exit(1)
  }

  console.log(`URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL}\n`)

  const applied: string[] = []
  const partial: Array<{ id: string; missing: string[] }> = []
  const missing: string[] = []

  for (const mig of MIGRATIONS) {
    const results = await Promise.all(mig.probes.map(p => runProbe(supabase, p)))
    const okCount = results.filter(r => r.present).length
    if (okCount === mig.probes.length) applied.push(mig.id)
    else if (okCount > 0) {
      partial.push({
        id: mig.id,
        missing: results.filter(r => !r.present).map(r => formatProbe(r.probe)),
      })
    } else missing.push(mig.id)
  }

  console.log(`✅ 완전 적용 (${applied.length}):`)
  applied.forEach(id => console.log(`   ${id}`))

  if (partial.length > 0) {
    console.log(`\n⚠️  부분 적용 (${partial.length}):`)
    partial.forEach(p => {
      console.log(`   ${p.id}`)
      p.missing.forEach(m => console.log(`      - 누락: ${m}`))
    })
  }

  if (missing.length > 0) {
    console.log(`\n❌ 미적용 (${missing.length}):`)
    missing.forEach(id => console.log(`   ${id}`))
  }

  console.log('')
  if (partial.length === 0 && missing.length === 0) {
    console.log('🎉 모든 마이그레이션이 완전히 적용되었습니다.')
  } else {
    console.log('💡 누락 항목을 재적용하려면 Supabase SQL Editor 에서 해당 마이그레이션의 alter/create 문을 실행하세요.')
  }
}

main().catch(err => {
  console.error('실행 실패:', err)
  process.exit(1)
})
