import { ImageResponse } from 'next/og'
import { OgLayout, OG_SIZE } from '@/lib/og-template'

export const size = OG_SIZE
export const contentType = 'image/png'
export const alt = 'AI Place 블로그 — 지역·업종 리서치'

export default async function OGImage() {
  return new ImageResponse(
    <OgLayout
      title="AI Place 블로그"
      subtitle="지역·업종별 추천, 비교, 가이드"
      badge="블로그"
    />,
    { ...size }
  )
}
