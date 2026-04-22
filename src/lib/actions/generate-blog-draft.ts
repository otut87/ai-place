'use server'

// T-129 / T-130 / T-135 — 블로그 초안 자동 생성 서버 액션.
// /admin/blog 캘린더 "+ AI 초안 생성" 버튼에서 호출.
//
// T-135: 임계값 override + 수동 업체 선택 모드 지원.

import { requireAuthForAction } from '@/lib/auth'
import { getAdminClient } from '@/lib/supabase/admin-client'
import { getAllPlaces, getCities, getSectors, getCategories } from '@/lib/data.supabase'
import { selectCandidatePlaces } from '@/lib/ai/select-candidate-places'
import { generateBlogDraft } from '@/lib/ai/generate-blog-draft'
import { revalidatePath } from 'next/cache'
import type { Place } from '@/lib/types'

// T-135: 초안 생성 모달에서 카테고리가 바뀔 때마다 업체 목록 조회.
export interface PlaceCandidateListing {
  slug: string
  name: string
  rating: number | null
  reviewCount: number | null
}

export async function listPlacesForCategoryAction(
  city: string,
  category: string,
): Promise<PlaceCandidateListing[]> {
  await requireAuthForAction()
  const admin = getAdminClient()
  if (!admin) return []
  const { data } = await admin
    .from('places')
    .select('slug, name, rating, review_count')
    .eq('city', city)
    .eq('category', category)
    .eq('status', 'active')
    .order('rating', { ascending: false, nullsFirst: false })
    .order('review_count', { ascending: false, nullsFirst: false })
    .limit(50)
  return ((data ?? []) as Array<{ slug: string; name: string; rating: number | null; review_count: number | null }>)
    .map(p => ({ slug: p.slug, name: p.name, rating: p.rating, reviewCount: p.review_count }))
}

export interface GenerateBlogDraftActionInput {
  city: string
  sector: string
  category?: string | null
  postType: 'keyword' | 'compare' | 'guide' | 'general'
  scheduledDate?: string | null
  /** 자동 선정 임계값 override. 미지정 시 기본(평점 4+, 리뷰 10+). */
  minRating?: number
  minReviewCount?: number
  maxCount?: number
  /** 수동 모드: 이 slug 들만 사용 (자동 필터 생략). */
  manualPlaceSlugs?: string[]
}

export type GenerateBlogDraftActionResult =
  | { success: true; slug: string; qualityScore: number; sevenBlockPassed: boolean; candidateCount: number }
  | { success: false; error: string }

export async function generateBlogDraftAction(
  input: GenerateBlogDraftActionInput,
): Promise<GenerateBlogDraftActionResult> {
  await requireAuthForAction()
  const admin = getAdminClient()
  if (!admin) return { success: false, error: 'admin_unavailable' }

  // 1. 마스터 데이터 로드
  const [cities, sectors, categories, places] = await Promise.all([
    getCities(),
    getSectors(),
    getCategories(),
    getAllPlaces(),
  ])
  const cityObj = cities.find(c => c.slug === input.city)
  const sectorObj = sectors.find(s => s.slug === input.sector)
  if (!cityObj) return { success: false, error: `city not found: ${input.city}` }
  if (!sectorObj) return { success: false, error: `sector not found: ${input.sector}` }

  // 카테고리 추정 — 미지정 시 sector 의 첫 카테고리
  const categorySlug = input.category ?? categories.find(c => c.sector === input.sector)?.slug
  if (!categorySlug) return { success: false, error: '카테고리를 결정할 수 없습니다' }
  const categoryObj = categories.find(c => c.slug === categorySlug)
  if (!categoryObj) return { success: false, error: `category not found: ${categorySlug}` }

  // 2. T-130: 후보 업체 선정 (수동 모드 우선, 없으면 자동 + 임계값 override 적용)
  const selection = selectCandidatePlaces({
    city: input.city,
    category: categorySlug,
    places,
    maxCount: input.maxCount ?? 5,
    minRating: input.minRating ?? 4.0,
    minReviewCount: input.minReviewCount ?? 10,
    manualSlugs: input.manualPlaceSlugs,
  })
  if (selection.places.length === 0) {
    return { success: false, error: selection.warning ?? '조건을 만족하는 후보 업체가 없습니다' }
  }

  // 3. T-129: LLM 초안 생성
  let draft
  try {
    draft = await generateBlogDraft({
      city: input.city,
      cityName: cityObj.name,
      category: categorySlug,
      categoryName: categoryObj.name,
      sector: input.sector,
      postType: input.postType,
      candidatePlaces: selection.places,
      selectionReasoning: selection.reasoning,
    })
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'LLM 호출 실패' }
  }

  // 4. slug 생성 (ASCII only)
  const suffix = Math.random().toString(36).slice(2, 6).replace(/[^a-z0-9]/g, '').padEnd(4, 'x')
  const slug = `${input.city}-${input.sector}-${input.postType}-${suffix}`

  // 5. blog_posts INSERT
  // T-200: places_mentioned — 업체 귀속 측정의 근거. id 가 있는 행만 기록 (seed fallback 에는 id 없을 수 있음).
  const placesMentioned = selection.places
    .map((p) => (p as Place & { id?: string }).id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0)

  const payload = {
    slug,
    title: draft.title,
    summary: draft.summary,
    content: draft.content,
    city: input.city,
    sector: input.sector,
    category: categorySlug,
    post_type: input.postType,
    tags: draft.tags,
    faqs: draft.faqs,
    related_place_slugs: selection.places.map(p => p.slug),
    places_mentioned: placesMentioned,
    quality_score: draft.qualityScore,
    status: 'draft',
    published_at: input.scheduledDate ? new Date(input.scheduledDate).toISOString() : null,
  }
  const { error } = await admin.from('blog_posts').insert(payload)
  if (error) return { success: false, error: error.message }

  // 6. ai_generations 기록 (T-013 연계) — best-effort, 실패해도 draft 저장은 유지
  try {
    await admin.from('ai_generations').insert({
      stage: 'blog_draft',
      model: 'claude-sonnet-4-6',
      input_tokens: draft.tokensUsed.input,
      output_tokens: draft.tokensUsed.output,
      quality_score: draft.qualityScore,
    })
  } catch (_e) {
    // 로그만
  }

  revalidatePath('/admin/blog')
  return {
    success: true,
    slug,
    qualityScore: draft.qualityScore,
    sevenBlockPassed: draft.sevenBlockPassed,
    candidateCount: selection.places.length,
  }
}
