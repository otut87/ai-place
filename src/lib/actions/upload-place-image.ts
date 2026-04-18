'use server'

// T-050 — 업체 이미지 업로드 / 메타 병합 / 삭제 서버 액션.
// Supabase Storage 'places-images' 버킷 + places.images JSONB 를 연결.

import { requireAuthForAction } from '@/lib/auth'
import { getAdminClient } from '@/lib/supabase/admin-client'
import { revalidatePath } from 'next/cache'
import {
  validateImageUpload,
  makeStorageKey,
  type PlaceImageType,
} from '@/lib/admin/place-images'

export interface UploadPlaceImageInput {
  placeId: string
  filename: string
  mimeType: string
  alt: string
  type: PlaceImageType
  // 업로드 바이트 — server action 로 전달 시 Uint8Array/Buffer 직렬화 필요.
  body: ArrayBuffer | Uint8Array
}

export interface UploadPlaceImageResult {
  success: boolean
  error?: string
  image?: { url: string; alt: string; type: PlaceImageType; key: string }
}

const BUCKET = 'places-images'

async function fetchImages(supabase: ReturnType<typeof getAdminClient>, placeId: string) {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('places')
    .select('city, category, slug, images')
    .eq('id', placeId)
    .single()
  if (error) return null
  return data as { city: string; category: string; slug: string; images: unknown } | null
}

function normalizeImages(raw: unknown): Array<{ url: string; alt: string; type: PlaceImageType }> {
  if (!Array.isArray(raw)) return []
  return raw.filter((x): x is { url: string; alt: string; type: PlaceImageType } =>
    Boolean(x && typeof x === 'object' && typeof (x as { url?: unknown }).url === 'string'),
  )
}

function revalidatePlace(row: { city: string; category: string; slug: string }) {
  revalidatePath('/admin/places')
  revalidatePath(`/${row.city}/${row.category}`)
  revalidatePath(`/${row.city}/${row.category}/${row.slug}`)
}

export async function uploadPlaceImage(input: UploadPlaceImageInput): Promise<UploadPlaceImageResult> {
  await requireAuthForAction()

  const sizeBytes = input.body instanceof Uint8Array
    ? input.body.byteLength
    : input.body.byteLength

  const validation = validateImageUpload({
    filename: input.filename,
    mimeType: input.mimeType,
    sizeBytes,
    alt: input.alt,
    type: input.type,
  })
  if (!validation.ok) {
    return { success: false, error: validation.errors.join(' / ') }
  }

  const supabase = getAdminClient()
  if (!supabase) return { success: false, error: 'Admin 클라이언트 초기화 실패' }

  const row = await fetchImages(supabase, input.placeId)
  if (!row) return { success: false, error: '업체를 찾을 수 없습니다.' }

  let key: string
  try {
    key = makeStorageKey(input.placeId, input.filename)
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }

  const bytes = input.body instanceof Uint8Array ? input.body : new Uint8Array(input.body)
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(key, bytes, { contentType: input.mimeType, upsert: false })
  if (uploadError) {
    console.error('[upload-place-image] Upload failed:', uploadError)
    return { success: false, error: '이미지 업로드에 실패했습니다.' }
  }

  const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(key)
  const publicUrl = publicData?.publicUrl
  if (!publicUrl) {
    return { success: false, error: '업로드된 이미지 URL 을 가져오지 못했습니다.' }
  }

  const nextImages = [
    ...normalizeImages(row.images),
    { url: publicUrl, alt: input.alt.trim(), type: input.type },
  ]

  const { error: updateError } = await supabase
    .from('places')
    .update({ images: nextImages })
    .eq('id', input.placeId)
  if (updateError) {
    console.error('[upload-place-image] places.images 업데이트 실패:', updateError)
    return { success: false, error: '이미지 메타 저장에 실패했습니다.' }
  }

  revalidatePlace(row)
  return {
    success: true,
    image: { url: publicUrl, alt: input.alt.trim(), type: input.type, key },
  }
}

export async function removePlaceImage(placeId: string, url: string): Promise<{ success: boolean; error?: string }> {
  await requireAuthForAction()
  if (!placeId || !url) return { success: false, error: '필수 파라미터가 없습니다.' }

  const supabase = getAdminClient()
  if (!supabase) return { success: false, error: 'Admin 클라이언트 초기화 실패' }

  const row = await fetchImages(supabase, placeId)
  if (!row) return { success: false, error: '업체를 찾을 수 없습니다.' }

  const existing = normalizeImages(row.images)
  const matched = existing.find(img => img.url === url)
  const filtered = existing.filter(img => img.url !== url)

  // Storage key 는 public URL 뒤쪽 '/places-images/' 이후가 경로.
  if (matched) {
    const marker = `/${BUCKET}/`
    const idx = url.indexOf(marker)
    if (idx >= 0) {
      const key = url.slice(idx + marker.length)
      const { error } = await supabase.storage.from(BUCKET).remove([key])
      if (error) {
        console.error('[remove-place-image] Storage 삭제 실패:', error)
      }
    }
  }

  const { error: updateError } = await supabase
    .from('places')
    .update({ images: filtered })
    .eq('id', placeId)
  if (updateError) {
    return { success: false, error: '이미지 메타 저장에 실패했습니다.' }
  }

  revalidatePlace(row)
  return { success: true }
}
