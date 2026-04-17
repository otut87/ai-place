#!/usr/bin/env tsx
/**
 * scripts/backfill-same-as.ts (T-029)
 *
 * 기존 등록 업체에 naverPlaceUrl, kakaoMapUrl, googleBusinessUrl (sameAs) 를 자동 입력.
 * 업체명 + 주소로 3-Source 통합 검색 → 최상위 후보의 외부 URL 을 매칭.
 *
 * Usage:
 *   npm run backfill:sameas -- --dry-run    # 변경사항 미리보기
 *   npm run backfill:sameas                 # 실제 update
 *
 * 사전조건:
 *   - 012_places_external_ids.sql 적용 완료
 *   - NAVER_CLIENT_ID/SECRET, KAKAO_REST_KEY, GOOGLE_PLACES_KEY 환경변수
 *   - SUPABASE_SERVICE_ROLE_KEY
 */
import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())

import { getAdminClient } from '../src/lib/supabase/admin-client'
import { unifiedSearch } from '../src/lib/search/unified'
import { isSameBusiness } from '../src/lib/search/dedup'

interface CliArgs {
  dryRun: boolean
}

function parseArgs(): CliArgs {
  return { dryRun: process.argv.includes('--dry-run') }
}

interface PlaceRow {
  id: string
  slug: string
  name: string
  address: string
  latitude: number | null
  longitude: number | null
  naver_place_url: string | null
  kakao_map_url: string | null
  google_business_url: string | null
  kakao_place_id: string | null
  naver_place_id: string | null
  google_place_id: string | null
}

async function fetchPlacesMissingSameAs(): Promise<PlaceRow[]> {
  const client = getAdminClient()
  if (!client) throw new Error('admin client 초기화 실패 — SUPABASE_SERVICE_ROLE_KEY 확인')
  const { data, error } = await client
    .from('places')
    .select(
      'id, slug, name, address, latitude, longitude, naver_place_url, kakao_map_url, google_business_url, kakao_place_id, naver_place_id, google_place_id',
    )
    .order('created_at', { ascending: true })
  if (error) throw new Error(`places 조회 실패: ${error.message}`)
  return (data ?? []) as PlaceRow[]
}

interface UpdatePayload {
  naver_place_url?: string | null
  kakao_map_url?: string | null
  google_business_url?: string | null
  kakao_place_id?: string | null
  naver_place_id?: string | null
  google_place_id?: string | null
}

function needsBackfill(row: PlaceRow): boolean {
  return (
    !row.naver_place_url || !row.kakao_map_url || !row.google_business_url
  )
}

type MatchOutcome =
  | { kind: 'no-search-results' }
  | { kind: 'no-matching-candidate'; candidates: number }
  | { kind: 'matched-no-new-urls' }
  | { kind: 'update'; payload: UpdatePayload }

async function matchRow(row: PlaceRow): Promise<MatchOutcome> {
  const results = await unifiedSearch(row.name)
  if (results.length === 0) return { kind: 'no-search-results' }

  const match = results.find(c =>
    isSameBusiness(
      {
        name: row.name,
        roadAddress: row.address,
        jibunAddress: row.address,
        latitude: row.latitude ?? undefined,
        longitude: row.longitude ?? undefined,
      },
      {
        name: c.displayName,
        roadAddress: c.roadAddress,
        jibunAddress: c.jibunAddress,
        latitude: c.latitude,
        longitude: c.longitude,
      },
    ),
  )
  if (!match) return { kind: 'no-matching-candidate', candidates: results.length }

  const payload: UpdatePayload = {}
  // sameAs URL 보강 (이미 있으면 유지)
  if (!row.google_business_url) {
    // google_business_url 은 현재 merge 결과에 직접 없지만 place_id 로 추론 가능
    if (match.googlePlaceId) {
      payload.google_business_url = `https://www.google.com/maps/place/?q=place_id:${match.googlePlaceId}`
      payload.google_place_id = match.googlePlaceId
    }
  }
  if (!row.kakao_map_url) {
    const kakaoUrl = match.sameAs.find(u => u.includes('kakao'))
    if (kakaoUrl) {
      payload.kakao_map_url = kakaoUrl
      if (match.kakaoPlaceId) payload.kakao_place_id = match.kakaoPlaceId
    }
  }
  if (!row.naver_place_url) {
    const naverUrl = match.sameAs.find(u => u.includes('naver'))
    if (naverUrl) payload.naver_place_url = naverUrl
  }
  return Object.keys(payload).length > 0
    ? { kind: 'update', payload }
    : { kind: 'matched-no-new-urls' }
}

async function main() {
  const args = parseArgs()
  console.log(`[backfill-sameas] mode: ${args.dryRun ? 'DRY-RUN' : 'APPLY'}`)

  const places = await fetchPlacesMissingSameAs()
  console.log(`[backfill-sameas] DB 에서 ${places.length} 곳 조회`)
  const targets = places.filter(needsBackfill)
  console.log(`[backfill-sameas] sameAs 누락: ${targets.length} 곳`)

  const client = getAdminClient()!
  let applied = 0
  const stats = { noSearch: 0, noMatch: 0, noNewUrls: 0 }
  for (const row of targets) {
    try {
      const outcome = await matchRow(row)
      switch (outcome.kind) {
        case 'no-search-results':
          console.log(`  · ${row.name} (${row.slug}) — 검색 결과 0건`)
          stats.noSearch += 1
          break
        case 'no-matching-candidate':
          console.log(`  · ${row.name} (${row.slug}) — 후보 ${outcome.candidates}건 있으나 주소/좌표 불일치`)
          stats.noMatch += 1
          break
        case 'matched-no-new-urls':
          console.log(`  · ${row.name} (${row.slug}) — 매칭됨, 추가할 sameAs URL 0개 (Kakao/Naver 미등록 또는 이미 설정됨)`)
          stats.noNewUrls += 1
          break
        case 'update': {
          const keys = Object.keys(outcome.payload).join(', ')
          console.log(`  ✓ ${row.name} (${row.slug}): ${keys}`)
          if (!args.dryRun) {
            const { error } = await (client.from('places') as ReturnType<typeof client.from>)
              .update(outcome.payload as never)
              .eq('id', row.id)
            if (error) {
              console.error(`    update 실패: ${error.message}`)
              break
            }
            applied += 1
          }
          break
        }
      }
    } catch (err) {
      console.error(`  ✗ ${row.name}: ${err instanceof Error ? err.message : err}`)
    }
  }

  console.log(
    `\n[backfill-sameas] 완료 — ${args.dryRun ? '(DRY-RUN)' : `업데이트 ${applied}`} ` +
      `| 검색 0건: ${stats.noSearch}, 후보 불일치: ${stats.noMatch}, 추가 URL 없음: ${stats.noNewUrls}`,
  )
}

main().catch(err => {
  console.error('[backfill-sameas] 치명적 오류:', err)
  process.exit(1)
})
