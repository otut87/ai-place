'use client'

// T-050 — 업체 이미지 업로드 위젯.
// 파일 선택 → 검증 → ArrayBuffer 로 읽어 서버 액션 호출.
// 대량 리사이즈는 향후 과제(WO #33); 현 단계는 원본 업로드(최대 5MB) + alt/type 메타 강제.

import { useState, useTransition } from 'react'
import {
  ALLOWED_IMAGE_MIME,
  IMAGE_TYPE_OPTIONS,
  MAX_IMAGE_BYTES,
  validateImageUpload,
  type PlaceImageType,
} from '@/lib/admin/place-images'
import type { UploadPlaceImageResult } from '@/lib/actions/upload-place-image'

type UploadFn = (input: {
  placeId: string
  filename: string
  mimeType: string
  alt: string
  type: PlaceImageType
  body: ArrayBuffer
}) => Promise<UploadPlaceImageResult>

type RemoveFn = (placeId: string, url: string) => Promise<{ success: boolean; error?: string }>

interface Props {
  placeId: string
  existingImages: Array<{ url: string; alt: string; type: PlaceImageType }>
  onUpload: UploadFn
  onRemove?: RemoveFn
}

export function PlaceImageUploader({ placeId, existingImages, onUpload, onRemove }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [alt, setAlt] = useState('')
  const [type, setType] = useState<PlaceImageType>('exterior')
  const [error, setError] = useState<string | null>(null)
  const [images, setImages] = useState(existingImages)
  const [pending, startTransition] = useTransition()

  function handlePick(files: FileList | null) {
    setError(null)
    const picked = files && files[0]
    if (!picked) {
      setFile(null)
      return
    }
    setFile(picked)
  }

  async function handleUpload() {
    if (!file) {
      setError('파일을 선택하세요.')
      return
    }
    const v = validateImageUpload({
      filename: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      alt,
      type,
    })
    if (!v.ok) {
      setError(v.errors.join(' / '))
      return
    }
    setError(null)
    const body = await file.arrayBuffer()
    startTransition(async () => {
      const result = await onUpload({
        placeId,
        filename: file.name,
        mimeType: file.type,
        alt,
        type,
        body,
      })
      if (result.success && result.image) {
        setImages(prev => [...prev, { url: result.image!.url, alt: result.image!.alt, type: result.image!.type }])
        setFile(null)
        setAlt('')
      } else {
        setError(result.error ?? '업로드 실패')
      }
    })
  }

  async function handleRemove(url: string) {
    if (!onRemove) return
    const r = await onRemove(placeId, url)
    if (r.success) {
      setImages(prev => prev.filter(img => img.url !== url))
    } else {
      setError(r.error ?? '삭제 실패')
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-[#dddddd] p-4">
      <h3 className="text-sm font-semibold text-[#222222]">이미지</h3>

      {images.length > 0 && (
        <ul className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {images.map(img => (
            <li key={img.url} className="relative overflow-hidden rounded border border-[#e5e7eb]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt={img.alt} className="h-24 w-full object-cover" />
              <div className="p-1 text-[10px] text-[#6a6a6a]">
                <span className="font-medium text-[#484848]">{img.type}</span>
                <p className="truncate">{img.alt}</p>
              </div>
              {onRemove && (
                <button
                  type="button"
                  onClick={() => handleRemove(img.url)}
                  className="absolute right-1 top-1 rounded-full bg-white/80 px-1 text-[10px] text-red-600 hover:bg-white"
                >
                  삭제
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-2 md:grid-cols-3">
        <input
          type="file"
          accept={(ALLOWED_IMAGE_MIME as readonly string[]).join(',')}
          onChange={e => handlePick(e.target.files)}
          className="text-xs"
        />
        <select
          value={type}
          onChange={e => setType(e.target.value as PlaceImageType)}
          className="h-9 rounded-md border border-[#dddddd] px-2 text-xs"
        >
          {IMAGE_TYPE_OPTIONS.map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <input
          type="text"
          value={alt}
          onChange={e => setAlt(e.target.value)}
          placeholder="alt 텍스트 (필수, 5~120자)"
          className="h-9 rounded-md border border-[#dddddd] px-2 text-xs"
        />
      </div>
      {file && (
        <p className="text-xs text-[#6a6a6a]">
          선택: {file.name} · {Math.round(file.size / 1024)}KB · 최대 {Math.round(MAX_IMAGE_BYTES / 1024 / 1024)}MB
        </p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        type="button"
        onClick={handleUpload}
        disabled={pending}
        className="h-9 rounded-md bg-[#222222] px-4 text-xs text-white hover:opacity-90 disabled:opacity-50"
      >
        {pending ? '업로드 중...' : '이미지 추가'}
      </button>
    </div>
  )
}
