// T-195 — 이미지 생성기 (Phase 3).
//
// 3층 구성:
//  1) 메인 썸네일: OpenAI gpt-image-2 low ($0.006/이미지 ≈ 8원) — Supabase Storage `blog-thumbnails/` 업로드
//  2) 인포그래픽: SVG 동적 생성 (원가 0) — pipeline 에서 svg-* 컴포넌트로 렌더, data URI
//  3) 업체 사진: Google Places photo API ($0.007/호출) — 업체상세 글에만
//
// OpenAI SDK 는 package.json 에 없음 — fetch 로 직접 호출 (의존성 증가 회피).

import { getAdminClient } from '@/lib/supabase/admin-client'
import { getPhotoUrl } from '@/lib/google-places'
import type { Place } from '@/lib/types'
import type { AngleKey } from '@/lib/blog/keyword-generator'
import { buildThumbnailPrompt } from '@/lib/ai/image-prompt-builder'

const OPENAI_IMAGE_URL = 'https://api.openai.com/v1/images/generations'

export interface GenerateThumbnailInput {
  /** alt 속성·파일 메타용 — 이미지 안에는 렌더되지 않음 (순수 일러스트 정책). */
  title: string
  /** Direct Answer Block (50~80자) — 일러스트의 의미 앵커. */
  summary: string
  /** 숫자·사실 훅 1~3개 (예: "리뷰 412건", "평점 4.7", "전문의 2인"). */
  highlights?: string[]
  categoryName: string
  cityName: string
  /** 10 sector 중 하나 — sector motif/palette 선택. */
  sector: string
  angle: AngleKey
  /** 블로그 슬러그 — storage 파일명에 사용 (중복 방지). */
  slug: string
  /** 테스트 override. */
  apiKey?: string
  /** 테스트 override — 실제 업로드 생략. */
  skipUpload?: boolean
  /** fetch override (테스트용). */
  fetchImpl?: typeof fetch
}

export interface GenerateThumbnailResult {
  url: string | null              // Supabase public URL (업로드 실패 시 null)
  alt: string
  model: string
  latencyMs: number
  error?: string
}

// 프롬프트 빌더는 src/lib/ai/image-prompt-builder.ts 로 분리됨 (테스트 쉬움 + 재사용).

async function uploadThumbnail(
  pngBytes: Uint8Array,
  slug: string,
): Promise<{ url: string | null; error?: string }> {
  const admin = getAdminClient()
  if (!admin) return { url: null, error: 'admin client 미초기화' }

  const path = `${slug}.png`
  const { error } = await admin.storage
    .from('blog-thumbnails')
    .upload(path, pngBytes, {
      contentType: 'image/png',
      upsert: true,
    })

  if (error) return { url: null, error: error.message }

  const { data } = admin.storage.from('blog-thumbnails').getPublicUrl(path)
  return { url: data.publicUrl }
}

/**
 * gpt-image-2 low 썸네일 생성 + Supabase Storage 업로드.
 * OpenAI API 키 없으면 throw. 업로드 실패 시 url=null 로 graceful degrade.
 */
export async function generateMainThumbnail(
  input: GenerateThumbnailInput,
): Promise<GenerateThumbnailResult> {
  const apiKey = input.apiKey ?? process.env.OPENAI_API_KEY
  if (!apiKey) {
    return {
      url: null,
      alt: input.title,
      model: 'gpt-image-2',
      latencyMs: 0,
      error: 'OPENAI_API_KEY 미설정',
    }
  }

  const fetchImpl = input.fetchImpl ?? fetch
  const prompt = buildThumbnailPrompt({
    summary: input.summary,
    highlights: input.highlights,
    categoryName: input.categoryName,
    cityName: input.cityName,
    sector: input.sector,
    angle: input.angle,
  })

  const start = Date.now()
  const res = await fetchImpl(OPENAI_IMAGE_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-image-2',
      prompt,
      size: '1024x1024',
      quality: 'low',
      n: 1,
    }),
  })
  const latencyMs = Date.now() - start

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    return {
      url: null,
      alt: input.title,
      model: 'gpt-image-2',
      latencyMs,
      error: `OpenAI ${res.status}: ${text.slice(0, 200)}`,
    }
  }

  const data = await res.json() as { data?: Array<{ b64_json?: string; url?: string }> }
  const first = data.data?.[0]
  if (!first) {
    return { url: null, alt: input.title, model: 'gpt-image-2', latencyMs, error: 'empty data' }
  }

  // b64_json 우선, 없으면 url 을 가져와 재다운로드
  let bytes: Uint8Array
  if (first.b64_json) {
    bytes = Uint8Array.from(Buffer.from(first.b64_json, 'base64'))
  } else if (first.url) {
    const imgRes = await fetchImpl(first.url)
    const buf = await imgRes.arrayBuffer()
    bytes = new Uint8Array(buf)
  } else {
    return { url: null, alt: input.title, model: 'gpt-image-2', latencyMs, error: 'no image payload' }
  }

  if (input.skipUpload) {
    return { url: `data:image/png;base64,${Buffer.from(bytes).toString('base64').slice(0, 32)}…`, alt: input.title, model: 'gpt-image-2', latencyMs }
  }

  const upload = await uploadThumbnail(bytes, input.slug)
  return {
    url: upload.url,
    alt: input.title,
    model: 'gpt-image-2',
    latencyMs,
    error: upload.error,
  }
}

// ==========================================================================
// 업체 사진 — Google Places photoRefs → getPhotoUrl
// ==========================================================================

export interface FetchPlacePhotosInput {
  places: Place[]                 // verifiedPlaces — places.photoRefs 포함된 상태
  maxPerPlace?: number
  maxTotal?: number
}

export interface FetchPlacePhotosResult {
  photos: Array<{ placeSlug: string; placeName: string; url: string; alt: string }>
  count: number
}

/**
 * verifiedPlaces 의 photoRefs 에서 Google Places photo URL 생성.
 * API 호출 비용: getPhotoUrl 은 URL 만 생성 (실제 CDN 호출은 사용자 브라우저 시점).
 * 단, Google 의 fee 는 이 URL 이 실제 로드될 때 과금.
 */
export function fetchPlacePhotos(input: FetchPlacePhotosInput): FetchPlacePhotosResult {
  const maxPerPlace = input.maxPerPlace ?? 2
  const maxTotal = input.maxTotal ?? 6

  const photos: FetchPlacePhotosResult['photos'] = []
  for (const p of input.places) {
    const refs = (p as Place & { photoRefs?: string[] }).photoRefs ?? []
    for (const ref of refs.slice(0, maxPerPlace)) {
      if (!ref) continue
      try {
        const url = getPhotoUrl(ref, 800)
        photos.push({
          placeSlug: p.slug,
          placeName: p.name,
          url,
          alt: `${p.name} 사진`,
        })
        if (photos.length >= maxTotal) break
      } catch {
        // getPhotoUrl 이 API 키 없을 때 throw — 조용히 스킵
      }
    }
    if (photos.length >= maxTotal) break
  }

  return { photos, count: photos.length }
}
