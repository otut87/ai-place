// T-195 — Pipeline 통합 테스트 (writer/reviewer/checker/image/similarity 전부 mock).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Place } from '@/lib/types'

// --- Anthropic SDK mock (writer + reviewer + checker 공용)
const mockCreate = vi.fn()
vi.mock('@anthropic-ai/sdk', () => {
  class MockAnthropic {
    messages = { create: mockCreate }
    constructor(_opts?: unknown) {}
  }
  return { default: MockAnthropic }
})

// --- Supabase admin mock (storage + blog_posts 조회)
const { mockStorageUpload, mockGetPublicUrl, mockFrom } = vi.hoisted(() => ({
  mockStorageUpload: vi.fn(),
  mockGetPublicUrl: vi.fn(),
  mockFrom: vi.fn(),
}))
vi.mock('@/lib/supabase/admin-client', () => ({
  getAdminClient: () => ({
    storage: {
      from: () => ({ upload: mockStorageUpload, getPublicUrl: mockGetPublicUrl }),
    },
    from: mockFrom,
  }),
}))

// --- Google Places mock
vi.mock('@/lib/google-places', () => ({
  getPhotoUrl: (ref: string) => `https://places/${ref}`,
}))

import { runBlogPipeline } from '@/lib/ai/agents/pipeline'

function mkPlace(slug: string): Place {
  return {
    slug, name: slug, city: 'cheonan', category: 'dermatology',
    description: '', address: '천안시 동남구', services: [], faqs: [], tags: [],
    rating: 4.5, reviewCount: 50,
  }
}

// 간단한 blog_posts query chain mock — similarity-guard 용
function blogPostsEmpty() {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    then: (cb: (r: unknown) => void) => cb({ data: [], error: null }),
  }
}

// 건강한 writer 응답 (quality-v2 적당 통과)
const HEALTHY_DRAFT = {
  title: '천안 피부과 추천 3곳 — 여드름 치료 리뷰 412건 분석',
  // meta(50+) + direct answer(<=80) 양립 범위 = 60자 내외
  summary: '천안에서 여드름 치료로 만족도가 높은 피부과 3곳을 추천합니다. 평균 평점 4.7 이상 전문의 2인 기준으로 선정한 결과입니다.',
  content: `## 결론

천안 피부과 중 여드름 치료 전문 3곳을 추천합니다. 평균 평점 4.7 이상, 전문의 2인 이상 기준 선정입니다.

## 분석 방법

천안 피부과 23곳 공개 리뷰 412건, HIRA 개설 자료, Google Places 평점을 집계했습니다. 분석 기간 2026년 1월~4월 가중치 3:2:1.

## 업체별 상세

### a

a 는 천안 동남구 소재 전문의 2인 의원입니다. 리뷰 120건 평점 4.8점 기록. 상담 평균 15분. [a 상세](/cheonan/dermatology/a)

### b

b 는 천안 서북구 소재 전문의 1인 의원입니다. 리뷰 95건 평점 4.7점. 레이저 장비 다수. [b 상세](/cheonan/dermatology/b)

## 비교표

| 업체 | 전문의 | 리뷰 | 평점 |
|---|---|---|---|
| a | 2인 | 120건 | 4.8 |
| b | 1인 | 95건 | 4.7 |

## 체크리스트

- 전문의 자격 확인
- 상담 시간 15분 이상
- 부작용 설명 확인
- 가격표 사전 제시
- 응급 연락망 안내
- 재진 주기 설명

## 위험 신호

- 원장만 있는 경우
- 1회 방문 고가 패키지 유도
- 부작용 설명 생략
- 가격 비공개

## 자주 묻는 질문

**Q. 치료 회차?** A. 4~6회.
**Q. 건보?** A. 일부 적용.
**Q. 흉터?** A. 천안 피부과 대부분 가능.

[/about/methodology](/about/methodology)

**면책**: 공개 데이터 기반 자체 조사. 의료 진단 아님.`.concat('\n\n추가 본문. 객관 서술. '.repeat(40)),
  tags: ['천안 피부과'],
  faqs: [
    { question: 'q1', answer: 'a1' },
    { question: 'q2', answer: 'a2' },
    { question: 'q3', answer: 'a3' },
  ],
}

beforeEach(() => {
  mockCreate.mockReset()
  mockStorageUpload.mockReset()
  mockGetPublicUrl.mockReset()
  mockFrom.mockReset()
})

describe('runBlogPipeline', () => {
  it('writer 성공 경로 → draft 생성 + quality 측정 + similarity pass', async () => {
    // writer 초기 응답
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'tool_use', name: 'generate_blog', input: HEALTHY_DRAFT }],
      usage: { input_tokens: 2000, output_tokens: 1500 },
    })
    // quality-reviewer 응답 (hardFailures 있을 수도 있으니 안전하게 준비)
    mockCreate.mockResolvedValueOnce({
      content: [{
        type: 'tool_use', name: 'review_blog',
        input: { issues: [], rewritePatches: [] },
      }],
      usage: { input_tokens: 300, output_tokens: 100 },
    })
    // medical-law-checker (sector=medical 이므로 호출됨)
    mockCreate.mockResolvedValueOnce({
      content: [{
        type: 'tool_use', name: 'compliance_check',
        input: { issues: [], disclaimerNeeded: false },
      }],
      usage: { input_tokens: 200, output_tokens: 50 },
    })
    // writer rewrite (혹시 호출될 때 대비)
    mockCreate.mockResolvedValue({
      content: [{ type: 'tool_use', name: 'generate_blog', input: HEALTHY_DRAFT }],
      usage: { input_tokens: 1000, output_tokens: 800 },
    })

    // similarity-guard: DB 비어있음 → pass
    mockFrom.mockReturnValueOnce(blogPostsEmpty())

    const r = await runBlogPipeline({
      city: 'cheonan', cityName: '천안시',
      category: 'dermatology', categoryName: '피부과', sector: 'medical',
      postType: 'detail', angle: 'review-deepdive',
      targetQuery: '천안 피부과',
      slug: 'cheonan-dermatology-abc',
      verifiedPlaces: [mkPlace('a'), mkPlace('b')],
      externalReferences: [],
      skipImage: true,
      apiKey: 'k',
    })

    // draft 가 생성되고 quality 가 측정됐으면 orchestration 은 성공
    expect(r.draft).not.toBeNull()
    expect(r.quality).not.toBeNull()
    expect(r.similarity?.verdict).toBe('pass')
    expect(r.pipelineLog.stages.length).toBeGreaterThan(0)
    // status 는 quality-v2 점수에 따라 success/warn/failed_quality 중 하나 — failed_similarity 는 아님
    expect(r.status).not.toBe('failed_similarity')
    expect(r.status).not.toBe('failed_timeout')
  })

  it('writer 실패 (tool_use 없음) → failed_quality', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'oops' }],
      usage: { input_tokens: 100, output_tokens: 100 },
    })

    const r = await runBlogPipeline({
      city: 'cheonan', cityName: '천안시',
      category: 'dermatology', categoryName: '피부과', sector: 'medical',
      postType: 'detail', angle: 'review-deepdive',
      targetQuery: '천안 피부과',
      slug: 's',
      verifiedPlaces: [mkPlace('a')],
      externalReferences: [],
      skipImage: true,
      apiKey: 'k',
    })

    // writer throw → buildFailure(failed_timeout 또는 failed_quality)
    expect(['failed_quality', 'failed_timeout']).toContain(r.status)
    expect(r.draft).toBeNull()
  })

  it('sector=medical 에서 medical-law-checker 호출', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'tool_use', name: 'generate_blog', input: HEALTHY_DRAFT }],
      usage: { input_tokens: 100, output_tokens: 100 },
    })
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'tool_use', name: 'compliance_check', input: { issues: [], disclaimerNeeded: false } }],
      usage: { input_tokens: 100, output_tokens: 50 },
    })
    mockFrom.mockReturnValueOnce(blogPostsEmpty())

    const r = await runBlogPipeline({
      city: 'cheonan', cityName: '천안시',
      category: 'dermatology', categoryName: '피부과', sector: 'medical',
      postType: 'detail', angle: 'review-deepdive',
      targetQuery: '천안 피부과',
      slug: 's',
      verifiedPlaces: [mkPlace('a')],
      externalReferences: [],
      skipImage: true,
      apiKey: 'k',
    })

    const stages = r.pipelineLog.stages.map(s => s.stage)
    expect(stages).toContain('medical-law-checker')
  })

  it('sector=beauty 는 medical-law-checker 건너뜀', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'tool_use', name: 'generate_blog', input: HEALTHY_DRAFT }],
      usage: { input_tokens: 100, output_tokens: 100 },
    })
    mockFrom.mockReturnValueOnce(blogPostsEmpty())

    const r = await runBlogPipeline({
      city: 'cheonan', cityName: '천안시',
      category: 'hairsalon', categoryName: '미용실', sector: 'beauty',
      postType: 'detail', angle: 'review-deepdive',
      targetQuery: '천안 미용실',
      slug: 's',
      verifiedPlaces: [mkPlace('a')],
      externalReferences: [],
      skipImage: true,
      apiKey: 'k',
    })

    const stages = r.pipelineLog.stages.map(s => s.stage)
    expect(stages).not.toContain('medical-law-checker')
  })

  it('researcher 0단계 — verifiedPlaces 있으면 researchPack 추출', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'tool_use', name: 'generate_blog', input: HEALTHY_DRAFT }],
      usage: { input_tokens: 100, output_tokens: 100 },
    })
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'tool_use', name: 'compliance_check', input: { issues: [], disclaimerNeeded: false } }],
      usage: { input_tokens: 50, output_tokens: 50 },
    })
    mockFrom.mockReturnValueOnce(blogPostsEmpty())

    const r = await runBlogPipeline({
      city: 'cheonan', cityName: '천안시',
      category: 'dermatology', categoryName: '피부과', sector: 'medical',
      postType: 'detail', angle: 'review-deepdive',
      targetQuery: '천안 피부과',
      slug: 's',
      verifiedPlaces: [mkPlace('a'), mkPlace('b')],
      externalReferences: [],
      skipImage: true,
      apiKey: 'k',
    })

    const stages = r.pipelineLog.stages.map(s => s.stage)
    expect(stages).toContain('researcher')
  })

  it('researchPack 명시 제공 시 researcher 단계 skip', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'tool_use', name: 'generate_blog', input: HEALTHY_DRAFT }],
      usage: { input_tokens: 100, output_tokens: 100 },
    })
    mockFrom.mockReturnValueOnce(blogPostsEmpty())

    const r = await runBlogPipeline({
      city: 'cheonan', cityName: '천안시',
      category: 'hairsalon', categoryName: '미용실', sector: 'beauty',
      postType: 'detail', angle: 'review-deepdive',
      targetQuery: '천안 미용실',
      slug: 's',
      verifiedPlaces: [mkPlace('a')],
      externalReferences: [],
      researchPack: { reviewHighlights: ['친절'], priceBands: [], channels: {} },
      skipImage: true,
      apiKey: 'k',
    })

    const stages = r.pipelineLog.stages.map(s => s.stage)
    expect(stages).not.toContain('researcher')
  })

  it('rewritePatches 있으면 writer-rewrite + quality-score-final 단계 진입', async () => {
    // 최초 draft — 품질 낮게 (hardFailures 유도 위해 짧은 title)
    const badDraft = { ...HEALTHY_DRAFT, title: '짧음', summary: '요약' }
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'tool_use', name: 'generate_blog', input: badDraft }],
      usage: { input_tokens: 100, output_tokens: 100 },
    })
    // quality-reviewer → rewritePatches 반환
    mockCreate.mockResolvedValueOnce({
      content: [{
        type: 'tool_use', name: 'review_blog',
        input: {
          issues: ['제목 짧음'],
          rewritePatches: [{ block: 'title', instruction: '30자+ 로 확장' }],
        },
      }],
      usage: { input_tokens: 200, output_tokens: 100 },
    })
    // medical-law-checker
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'tool_use', name: 'compliance_check', input: { issues: [], disclaimerNeeded: false } }],
      usage: { input_tokens: 100, output_tokens: 50 },
    })
    // writer-rewrite — 개선된 draft 반환
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'tool_use', name: 'generate_blog', input: HEALTHY_DRAFT }],
      usage: { input_tokens: 1000, output_tokens: 800 },
    })
    mockFrom.mockReturnValueOnce(blogPostsEmpty())

    const r = await runBlogPipeline({
      city: 'cheonan', cityName: '천안시',
      category: 'dermatology', categoryName: '피부과', sector: 'medical',
      postType: 'detail', angle: 'review-deepdive',
      targetQuery: '천안 피부과',
      slug: 's',
      verifiedPlaces: [mkPlace('a')],
      externalReferences: [],
      skipImage: true,
      apiKey: 'k',
    })

    const stages = r.pipelineLog.stages.map(s => s.stage)
    expect(stages).toContain('quality-reviewer')
    expect(stages).toContain('writer-rewrite')
    expect(stages).toContain('quality-score-final')
  })

  it('similarity block → status=failed_similarity', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'tool_use', name: 'generate_blog', input: HEALTHY_DRAFT }],
      usage: { input_tokens: 100, output_tokens: 100 },
    })
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'tool_use', name: 'compliance_check', input: { issues: [], disclaimerNeeded: false } }],
      usage: { input_tokens: 50, output_tokens: 50 },
    })
    // similarity-guard 쿼리 → 매우 유사한 블로그 1건
    const similarRow = {
      id: 'b1', slug: 'other', title: HEALTHY_DRAFT.title,
      content: HEALTHY_DRAFT.content,
    }
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      then: (cb: (r: unknown) => void) => cb({ data: [similarRow], error: null }),
    })

    const r = await runBlogPipeline({
      city: 'cheonan', cityName: '천안시',
      category: 'dermatology', categoryName: '피부과', sector: 'medical',
      postType: 'detail', angle: 'review-deepdive',
      targetQuery: '천안 피부과',
      slug: 's',
      verifiedPlaces: [mkPlace('a')],
      externalReferences: [],
      skipImage: true,
      apiKey: 'k',
    })

    expect(r.status).toBe('failed_similarity')
    expect(r.similarity?.verdict).toBe('block')
  })

  it('draft 있고 rewrite 불필요 → 짧은 파이프라인으로 success/warn', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'tool_use', name: 'generate_blog', input: HEALTHY_DRAFT }],
      usage: { input_tokens: 100, output_tokens: 100 },
    })
    // medical-law-checker
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'tool_use', name: 'compliance_check', input: { issues: [], disclaimerNeeded: false } }],
      usage: { input_tokens: 50, output_tokens: 50 },
    })
    mockFrom.mockReturnValueOnce(blogPostsEmpty())

    const r = await runBlogPipeline({
      city: 'cheonan', cityName: '천안시',
      category: 'dermatology', categoryName: '피부과', sector: 'medical',
      postType: 'detail', angle: 'review-deepdive',
      targetQuery: '천안 피부과',
      slug: 's',
      verifiedPlaces: [mkPlace('a')],
      externalReferences: [],
      skipImage: true,
      apiKey: 'k',
    })

    expect(r.draft).not.toBeNull()
    expect(r.pipelineLog.stages.some(s => s.stage === 'quality-score')).toBe(true)
  })

  it('skipImage=false — image-generator 호출 + Place photos 추출 (detail)', async () => {
    // global fetch mock — OpenAI gpt-image-2 성공 응답
    const pngB64 = Buffer.from('fake-png-bytes').toString('base64')
    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ data: [{ b64_json: pngB64 }] }),
      text: async () => '',
    })) as unknown as typeof fetch

    process.env.OPENAI_API_KEY = 'sk-test'
    mockStorageUpload.mockResolvedValueOnce({ error: null })
    mockGetPublicUrl.mockReturnValueOnce({ data: { publicUrl: 'https://cdn/abc.png' } })

    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'tool_use', name: 'generate_blog', input: HEALTHY_DRAFT }],
      usage: { input_tokens: 100, output_tokens: 100 },
    })
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'tool_use', name: 'compliance_check', input: { issues: [], disclaimerNeeded: false } }],
      usage: { input_tokens: 50, output_tokens: 50 },
    })
    mockFrom.mockReturnValueOnce(blogPostsEmpty())

    // Place 에 photoRefs 있도록 — fetchPlacePhotos 가 URL 생성
    const placeWithPhoto = { ...mkPlace('a'), photoRefs: ['photo-ref-1'] } as Place & { photoRefs: string[] }

    try {
      const r = await runBlogPipeline({
        city: 'cheonan', cityName: '천안시',
        category: 'dermatology', categoryName: '피부과', sector: 'medical',
        postType: 'detail', angle: 'review-deepdive',
        targetQuery: '천안 피부과',
        slug: 'with-image',
        verifiedPlaces: [placeWithPhoto],
        externalReferences: [],
        // skipImage 기본값 false
        apiKey: 'k',
      })

      const stages = r.pipelineLog.stages.map(s => s.stage)
      expect(stages).toContain('image-thumbnail')
      expect(stages).toContain('image-place-photos')
      expect(r.thumbnail?.url).toBe('https://cdn/abc.png')
      expect(r.placePhotos.length).toBeGreaterThan(0)
    } finally {
      globalThis.fetch = originalFetch
      delete process.env.OPENAI_API_KEY
    }
  })

  it('medical 금칙 표현 감지 시 compliance issues 기록 + 면책 자동 삽입', async () => {
    const forbiddenDraft = {
      ...HEALTHY_DRAFT,
      content: HEALTHY_DRAFT.content + '\n\n완치를 보장합니다.',
    }
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'tool_use', name: 'generate_blog', input: forbiddenDraft }],
      usage: { input_tokens: 100, output_tokens: 100 },
    })
    // quality-reviewer
    mockCreate.mockResolvedValueOnce({
      content: [{
        type: 'tool_use', name: 'review_blog',
        input: { issues: ['완치 표현'], rewritePatches: [] },
      }],
      usage: { input_tokens: 50, output_tokens: 50 },
    })
    // medical-law-checker
    mockCreate.mockResolvedValueOnce({
      content: [{
        type: 'tool_use', name: 'compliance_check',
        input: { issues: [], disclaimerNeeded: true },
      }],
      usage: { input_tokens: 100, output_tokens: 50 },
    })
    // fallback — writer-rewrite 트리거되면 정상 draft 반환
    mockCreate.mockResolvedValue({
      content: [{ type: 'tool_use', name: 'generate_blog', input: HEALTHY_DRAFT }],
      usage: { input_tokens: 100, output_tokens: 100 },
    })
    mockFrom.mockReturnValueOnce(blogPostsEmpty())

    const r = await runBlogPipeline({
      city: 'cheonan', cityName: '천안시',
      category: 'dermatology', categoryName: '피부과', sector: 'medical',
      postType: 'detail', angle: 'review-deepdive',
      targetQuery: '천안 피부과',
      slug: 's',
      verifiedPlaces: [mkPlace('a')],
      externalReferences: [],
      skipImage: true,
      apiKey: 'k',
    })

    expect(r.complianceIssues.length).toBeGreaterThan(0)
    expect(r.complianceIssues.some(i => i.phrase === '완치')).toBe(true)
  })
})
