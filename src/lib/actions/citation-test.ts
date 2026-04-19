'use server'

// T-140 — Owner AI 인용 실측 테스트 서버 액션.
// 구독자 전용 + 업체별 주 1회 제한.

import { requireOwnerForAction } from '@/lib/owner/auth'
import { getAdminClient } from '@/lib/supabase/admin-client'
import { checkCitationTestRateLimit, hasActiveSubscription, buildCitationQueries } from '@/lib/diagnostic/citation-test'
import { callChatGPT, callClaude, callGemini, isPlaceCited, type Engine } from '@/lib/ai/llm-engines'
import { revalidatePath } from 'next/cache'

export interface CitationTestResult {
  success: true
  testId: string
  queriesCount: number
  resultsCount: number
  citedCount: number
  citationRate: number
  perQuery: Array<{
    query: string
    engines: Array<{ engine: Engine; cited: boolean; error?: string }>
  }>
}

export type CitationTestOutcome = CitationTestResult | { success: false; error: string; nextAllowedAt?: string; remainingHours?: number }

export async function runCitationTestAction(placeId: string): Promise<CitationTestOutcome> {
  const user = await requireOwnerForAction()
  const admin = getAdminClient()
  if (!admin) return { success: false, error: 'admin_unavailable' }

  // 1. place 조회 + 소유권 검증
  const { data: place } = await admin
    .from('places')
    .select('id, name, city, category, slug, customer_id')
    .eq('id', placeId)
    .maybeSingle()
  if (!place) return { success: false, error: '업체를 찾을 수 없습니다' }

  const placeRow = place as { id: string; name: string; city: string; category: string; slug: string; customer_id: string | null }

  // customer_id → customers.user_id 매칭
  if (placeRow.customer_id) {
    const { data: customer } = await admin
      .from('customers')
      .select('user_id')
      .eq('id', placeRow.customer_id)
      .maybeSingle()
    if (!customer || (customer as { user_id: string }).user_id !== user.id) {
      return { success: false, error: '이 업체에 대한 권한이 없습니다' }
    }
  } else {
    return { success: false, error: '업체에 고객 정보가 연결되어 있지 않습니다' }
  }

  // 2. 활성 구독 확인
  const subActive = await hasActiveSubscription(placeRow.customer_id)
  if (!subActive) {
    return { success: false, error: 'AI 인용 테스트는 활성 구독 고객만 이용할 수 있습니다' }
  }

  // 3. Rate limit 확인
  const rl = await checkCitationTestRateLimit(placeId)
  if (!rl.allowed) {
    return {
      success: false,
      error: `다음 테스트는 ${rl.remainingHours}시간 후 가능합니다 (주 1회 제한)`,
      nextAllowedAt: rl.nextAllowedAt ?? undefined,
      remainingHours: rl.remainingHours,
    }
  }

  // 4. citation_tests 레코드 생성
  const { data: testRow, error: testErr } = await admin
    .from('citation_tests')
    .insert({
      place_id: placeId,
      triggered_by: 'owner',
      engines: ['chatgpt', 'claude', 'gemini'],
    })
    .select('id')
    .single()
  if (testErr || !testRow) {
    return { success: false, error: testErr?.message ?? 'citation_tests 생성 실패' }
  }
  const testId = (testRow as { id: string }).id

  // 5. 쿼리 × 엔진 실행
  const cityName = placeRow.city // slug 가 표시명 역할 (실제 한글명 조회는 생략, 향후 개선 여지)
  const categoryName = placeRow.category
  const queries = buildCitationQueries(cityName, categoryName)

  const engines: Engine[] = ['chatgpt', 'claude', 'gemini']
  const perQuery: CitationTestResult['perQuery'] = []

  let resultsCount = 0
  let citedCount = 0

  for (const query of queries) {
    const perEngine: Array<{ engine: Engine; cited: boolean; error?: string }> = []
    for (const engine of engines) {
      try {
        const response = await (engine === 'chatgpt' ? callChatGPT(query)
          : engine === 'claude' ? callClaude(query)
          : callGemini(query))
        const cited = isPlaceCited(response, placeRow.name)
        resultsCount += 1
        if (cited) citedCount += 1
        perEngine.push({ engine, cited })

        // citation_results 저장 (test_prompts 먼저 확보)
        const { data: promptRow } = await admin
          .from('test_prompts')
          .insert({ text: query, category: placeRow.category, city: placeRow.city })
          .select('id')
          .single()
        if (promptRow) {
          await admin.from('citation_results').insert({
            prompt_id: (promptRow as { id: string }).id,
            engine,
            response,
            cited_sources: [],
            cited_places: cited ? [placeRow.name] : [],
            aiplace_cited: cited,
            session_id: `owner-${testId}`,
          })
        }
      } catch (err) {
        perEngine.push({ engine, cited: false, error: err instanceof Error ? err.message : 'unknown' })
      }
    }
    perQuery.push({ query, engines: perEngine })
  }

  // 6. citation_tests 업데이트
  const rate = resultsCount > 0 ? citedCount / resultsCount : 0
  await admin
    .from('citation_tests')
    .update({
      queries_count: queries.length,
      results_count: resultsCount,
      cited_count: citedCount,
      citation_rate: rate,
      finished_at: new Date().toISOString(),
    })
    .eq('id', testId)

  revalidatePath(`/owner/places/${placeId}`)
  revalidatePath(`/owner/places/${placeId}/dashboard`)

  return {
    success: true,
    testId,
    queriesCount: queries.length,
    resultsCount,
    citedCount,
    citationRate: rate,
    perQuery,
  }
}
