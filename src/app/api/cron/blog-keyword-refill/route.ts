// T-194 — 키워드 뱅크 refill 크론 (분기 1회).
// Vercel Cron 매 분기 1일 KST 04:00 (UTC 19:00 전날) 호출.
//
// 전략:
// - used_count 가 상위 N% 인 키워드는 "소진됐다"고 간주 → 해당 (sector, angle) 조합에
//   Haiku 로 새 키워드 batch 생성, 기존 풀과 Jaccard 0.4 대비 중복 제거 후 insert.
// - Haiku 호출은 분기 1회이므로 비용 부담 낮음 (건당 ~1~2원 × 수백 batch 당일 지연 분산 가능).

import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin-client'
import { generateKeywordsForSector, ANGLE_KEYS, type AngleKey } from '@/lib/blog/keyword-generator'
import { insertKeyword } from '@/lib/blog/keyword-bank'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

const TOP_USED_PERCENT = 0.2      // 상위 20% "소진" 키워드가 refill 타겟
const REFILL_PER_COMBO = 10       // (sector, angle) 조합당 신규 생성 수
const MIN_USED_COUNT = 3          // used_count 3 이상만 refill 대상 (갓 seed 된 것 보호)

export async function GET(req: Request) {
  const secret = process.env.VERCEL_CRON_SECRET
  const auth = req.headers.get('authorization') ?? ''
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const admin = getAdminClient()
  if (!admin) return NextResponse.json({ error: 'admin_unavailable' }, { status: 500 })

  // 1) 소진된 (sector, city, angle) 조합 추출.
  const { data: hotRows, error: hotErr } = await admin
    .from('keyword_bank')
    .select('sector, city, angle, used_count')
    .gte('used_count', MIN_USED_COUNT)
    .order('used_count', { ascending: false })
    .limit(500)

  if (hotErr) {
    return NextResponse.json({ error: `hot-query: ${hotErr.message}` }, { status: 500 })
  }

  const hot = (hotRows ?? []) as Array<{ sector: string; city: string | null; angle: string | null; used_count: number }>
  if (hot.length === 0) {
    return NextResponse.json({ ok: true, refillCombos: 0, inserted: 0, message: 'no hot keywords' })
  }

  // 상위 TOP_USED_PERCENT 만 추림
  const cutoff = Math.max(1, Math.floor(hot.length * TOP_USED_PERCENT))
  const topHot = hot.slice(0, cutoff)

  // (sector, city, angle) 유니크 조합 수집
  const comboKey = (s: string, c: string | null, a: string | null) => `${s}|${c ?? ''}|${a ?? ''}`
  const combos = new Map<string, { sector: string; city: string | null; angle: string | null }>()
  for (const r of topHot) {
    const key = comboKey(r.sector, r.city, r.angle)
    if (!combos.has(key)) combos.set(key, { sector: r.sector, city: r.city, angle: r.angle })
  }

  let inserted = 0
  const errors: string[] = []

  for (const combo of combos.values()) {
    // 기존 키워드 풀 조회 (유사도 체크용)
    const { data: existingRows } = await admin
      .from('keyword_bank')
      .select('keyword')
      .eq('sector', combo.sector)
      .limit(500)
    const existingKeywords = ((existingRows ?? []) as Array<{ keyword: string }>).map(r => r.keyword)

    try {
      const angleKey = ANGLE_KEYS.includes(combo.angle as AngleKey)
        ? (combo.angle as AngleKey)
        : 'review-deepdive'
      const gen = await generateKeywordsForSector({
        sector: combo.sector,
        city: combo.city ?? undefined,
        angle: angleKey,
        count: REFILL_PER_COMBO,
        existingKeywords,
      })

      for (const kw of gen.keywords) {
        const r = await insertKeyword({
          keyword: kw.keyword,
          sector: combo.sector,
          city: combo.city,
          angle: angleKey,
          priority: kw.priority,
          competition: kw.competition,
          longtails: kw.longtails,
          source: 'llm_generated',
        })
        if (r.inserted) inserted += 1
      }
    } catch (err) {
      errors.push(`${combo.sector}/${combo.city ?? '-'}/${combo.angle ?? '-'}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return NextResponse.json({
    ok: true,
    refillCombos: combos.size,
    inserted,
    errors: errors.slice(0, 10),
  })
}
