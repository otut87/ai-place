// T-196 — 블로그 파이프라인 consumer 크론 (Phase 4).
//
// 실행: 15분마다 (*/15 * * * *).
// 동작:
//   1) pop_blog_topic() RPC 로 큐에서 1건 원자 pop (FOR UPDATE SKIP LOCKED).
//   2) place/city/category context 수집 + externalReferences fetch.
//   3) runBlogPipeline() 호출 (writer→reviewer→checker→image→similarity).
//   4) 결과를 blog_posts INSERT + blog_topic_queue status 전환.
//   5) 실패 시 retry_count 증가, MAX_RETRIES 초과 시 영구 failed.
//
// 한 번 호출당 1건만 처리 — Vercel Pro 5분 한도 내 안정성 확보.

import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin-client'
import { getCities, getCategories, getAllPlaces } from '@/lib/data.supabase'
import { runBlogPipeline } from '@/lib/ai/agents/pipeline'
import { fetchExternalReferences } from '@/lib/blog/external-reference'
import { markKeywordUsed } from '@/lib/blog/keyword-bank'
import type { AngleKey } from '@/lib/blog/keyword-generator'
import { ANGLE_KEYS } from '@/lib/blog/keyword-generator'
import type { Place } from '@/lib/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300     // Vercel Pro 5분 한도 활용

const MAX_RETRIES = 3

type QueueRow = {
  id: string
  planned_date: string
  post_type: 'detail' | 'compare' | 'guide' | 'keyword'
  angle: string | null
  sector: string
  city: string
  category: string | null
  target_query: string | null
  keyword_id: string | null
  place_id: string | null
  scheduled_for: string
  retry_count: number
}

function generateSlug(row: QueueRow): string {
  const rand = Math.random().toString(36).slice(2, 6).padEnd(4, 'x')
  const parts = [row.city, row.category ?? row.sector, row.post_type, rand]
  return parts.join('-').replace(/[^a-z0-9-]/g, '')
}

export async function GET(req: Request) {
  const secret = process.env.VERCEL_CRON_SECRET
  const auth = req.headers.get('authorization') ?? ''
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const admin = getAdminClient()
  if (!admin) return NextResponse.json({ error: 'admin_unavailable' }, { status: 500 })

  // ─── 1. 큐에서 1건 pop ─────────────────────────────────────
  const { data: popped, error: popErr } = await admin.rpc('pop_blog_topic', {
    p_max_retries: MAX_RETRIES,
  })
  if (popErr) {
    return NextResponse.json({ error: `pop_failed: ${popErr.message}` }, { status: 500 })
  }
  const rows = (popped ?? []) as QueueRow[]
  if (rows.length === 0) {
    return NextResponse.json({ ok: true, consumed: 0, message: 'no ready topics' })
  }
  const topic = rows[0]

  const startedAt = Date.now()
  const finish = async (update: Partial<{
    status: string; error: string; blog_post_id: string | null; retry_count: number
  }>) => {
    await admin.from('blog_topic_queue').update({
      ...update,
      finished_at: new Date().toISOString(),
    }).eq('id', topic.id)
  }

  try {
    // ─── 2. Context 수집 ──────────────────────────────────
    const [cities, categories, allPlaces] = await Promise.all([
      getCities(), getCategories(), getAllPlaces(),
    ])
    const cityObj = cities.find(c => c.slug === topic.city)
    const categoryObj = topic.category ? categories.find(c => c.slug === topic.category) : null

    if (!cityObj) {
      await finish({ status: 'failed', error: `city not found: ${topic.city}` })
      return NextResponse.json({ ok: false, topicId: topic.id, error: 'city not found' }, { status: 200 })
    }

    // verifiedPlaces: place_id 명시되면 해당 업체 1곳, 아니면 city+category active 전체.
    let verifiedPlaces: Place[] = []
    if (topic.place_id) {
      verifiedPlaces = allPlaces.filter(p => {
        // Place 에 id 필드 없을 수 있음 — slug 기반 fallback
        const withId = p as Place & { id?: string }
        return withId.id === topic.place_id
      })
      if (verifiedPlaces.length === 0) {
        // fallback — place_id 는 DB 기준이므로 raw 조회
        const { data } = await admin.from('places').select('slug').eq('id', topic.place_id).single()
        if (data) {
          const found = allPlaces.find(p => p.slug === (data as { slug: string }).slug)
          if (found) verifiedPlaces = [found]
        }
      }
    } else if (topic.category) {
      verifiedPlaces = allPlaces.filter(p =>
        p.city === topic.city && p.category === topic.category && (p as Place & { status?: string }).status !== 'archived',
      )
    } else {
      // keyword 유형 — city 만 일치, 모든 카테고리
      verifiedPlaces = allPlaces.filter(p => p.city === topic.city)
    }

    // compare 는 최소 2곳, detail 은 최소 1곳, 그 외는 0곳도 OK (external 만으로 가능)
    if (topic.post_type === 'detail' && verifiedPlaces.length === 0) {
      await finish({ status: 'failed', error: 'detail 유형인데 해당 업체 없음' })
      return NextResponse.json({ ok: false, topicId: topic.id, error: 'no place for detail' }, { status: 200 })
    }

    // ─── 3. External references (내부 업체 < 5 일 때만) ──────
    const externalRefs = await fetchExternalReferences({
      sector: topic.sector,
      category: topic.category ?? undefined,
      cityName: cityObj.name,
      internalActiveCount: verifiedPlaces.length,
      minReferenceCount: 5,
      excludeNames: verifiedPlaces.map(p => p.name),
    })

    // ─── 4. Pipeline 실행 ────────────────────────────────
    const angle: AngleKey = ANGLE_KEYS.includes(topic.angle as AngleKey)
      ? (topic.angle as AngleKey)
      : 'review-deepdive'
    const slug = generateSlug(topic)
    const targetQuery = topic.target_query ?? `${cityObj.name} ${categoryObj?.name ?? ''}`.trim()

    const result = await runBlogPipeline({
      city: topic.city,
      cityName: cityObj.name,
      category: topic.category ?? 'general',
      categoryName: categoryObj?.name ?? '전체',
      sector: topic.sector,
      postType: topic.post_type,
      angle,
      targetQuery,
      slug,
      verifiedPlaces: verifiedPlaces.slice(0, 5),
      externalReferences: externalRefs.places,
    })

    // ─── 5. 결과 기록 ────────────────────────────────────
    if (!result.draft) {
      // 파이프라인 자체 실패 — retry
      const next = topic.retry_count + 1
      const failed = next >= MAX_RETRIES
      await finish({
        status: failed ? 'failed' : 'queued',  // 재시도 여지 있으면 queued 로 복귀
        retry_count: next,
        error: result.reason ?? 'pipeline failure',
      })
      return NextResponse.json({
        ok: false, topicId: topic.id, retry: next, exhausted: failed,
        reason: result.reason,
      })
    }

    // blog_posts INSERT
    const faqs = result.draft.faqs ?? []
    const { data: inserted, error: insErr } = await (admin
      .from('blog_posts') as ReturnType<typeof admin.from>)
      .insert({
        slug,
        title: result.draft.title,
        summary: result.draft.summary,
        content: result.draft.content,
        city: topic.city,
        sector: topic.sector,
        category: topic.category,
        post_type: topic.post_type,
        angle,
        target_query: targetQuery,
        keyword_id: topic.keyword_id,
        tags: result.draft.tags,
        faqs,
        related_place_slugs: verifiedPlaces.map(p => p.slug),
        quality_score: result.quality?.score ?? null,
        quality_rules_report: result.quality?.rulesReport ?? null,
        hard_failures: result.quality?.hardFailures ?? [],
        similarity_score: result.similarity?.similarity ?? null,
        thumbnail_url: result.thumbnail?.url ?? null,
        image_urls: {
          infographics: [],
          placePhotos: result.placePhotos.map(p => p.url),
        },
        pipeline_log: result.pipelineLog,
        status: 'draft',               // 관리자 검수 후 수동 active 전환
        published_at: null,
      } as never)
      .select('id')
      .single()

    if (insErr || !inserted) {
      await finish({
        status: 'failed',
        error: `blog_posts insert: ${insErr?.message ?? 'no data'}`,
      })
      return NextResponse.json({
        ok: false, topicId: topic.id, error: insErr?.message ?? 'insert failed',
      }, { status: 500 })
    }
    const blogId = (inserted as { id: string }).id

    // 키워드 사용 이력 기록
    if (topic.keyword_id) {
      await markKeywordUsed(topic.keyword_id, blogId)
    }

    // 큐 상태 전환 — pipeline status 를 그대로 반영 (warn 도 done 으로 취급, 관리자 검수)
    const finalStatus = result.status === 'failed_similarity'
      ? 'failed_similarity'
      : result.status === 'failed_quality'
      ? 'failed_quality'
      : result.status === 'failed_timeout'
      ? 'failed_timeout'
      : 'done'
    await finish({
      status: finalStatus,
      blog_post_id: blogId,
      error: result.reason ?? undefined,
    })

    const durationMs = Date.now() - startedAt
    return NextResponse.json({
      ok: true,
      consumed: 1,
      topicId: topic.id,
      blogId,
      slug,
      status: finalStatus,
      qualityScore: result.quality?.score,
      similarity: result.similarity?.similarity,
      durationMs,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    const next = topic.retry_count + 1
    const failed = next >= MAX_RETRIES
    await finish({
      status: failed ? 'failed' : 'queued',
      retry_count: next,
      error: `exception: ${msg}`,
    })
    return NextResponse.json({
      ok: false, topicId: topic.id, retry: next, exhausted: failed, error: msg,
    }, { status: 500 })
  }
}
