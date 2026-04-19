import { ImageResponse } from 'next/og'
import { getCities } from '@/lib/data.supabase'
import { getBlogPostsByCity } from '@/lib/blog/data.supabase'
import { OgLayout, OG_SIZE } from '@/lib/og-template'

export const size = OG_SIZE
export const contentType = 'image/png'
export const alt = 'AI Place 블로그 — 지역 허브'

export default async function OGImage({ params }: { params: Promise<{ city: string }> }) {
  const { city } = await params
  const [cities, posts] = await Promise.all([getCities(), getBlogPostsByCity(city)])
  const cityName = cities.find(c => c.slug === city)?.name ?? city

  return new ImageResponse(
    <OgLayout
      title={`${cityName} 블로그`}
      subtitle={`${posts.length}편의 지역·업종 리서치 글`}
      badge="지역 허브"
    />,
    { ...size }
  )
}
