import { ImageResponse } from 'next/og'
import { OgLayout, OG_SIZE } from '@/lib/og-template'

export const size = OG_SIZE
export const contentType = 'image/png'
export const alt = 'AI Place — 조사 방법론'

export default async function OGImage() {
  return new ImageResponse(
    <OgLayout
      title="조사 방법론"
      subtitle="공식 기관·지도 API·공개 리뷰·AI 인용 테스트"
      badge="소개"
    />,
    { ...size }
  )
}
