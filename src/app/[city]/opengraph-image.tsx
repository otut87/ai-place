import { ImageResponse } from 'next/og'
import { getCities, getAllPlaces } from '@/lib/data.supabase'
import { OgLayout, OG_SIZE } from '@/lib/og-template'

export const size = OG_SIZE
export const contentType = 'image/png'
export const alt = 'AI Place — 도시 허브'

export default async function OGImage({ params }: { params: Promise<{ city: string }> }) {
  const { city } = await params
  const [cities, allPlaces] = await Promise.all([getCities(), getAllPlaces()])
  const cityName = cities.find(c => c.slug === city)?.name ?? city
  const count = allPlaces.filter(p => p.city === city).length

  return new ImageResponse(
    <OgLayout
      title={`${cityName} 업체 디렉토리`}
      subtitle={`${count}곳의 업체 · AI가 추천하는 우리 동네`}
      badge="도시 허브"
    />,
    { ...size }
  )
}
