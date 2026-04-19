import { ImageResponse } from 'next/og'
import { getCities } from '@/lib/data.supabase'
import { getSectors } from '@/lib/data.supabase'
import { getBlogPostsBySector } from '@/lib/blog/data.supabase'
import { OgLayout, OG_SIZE } from '@/lib/og-template'

export const size = OG_SIZE
export const contentType = 'image/png'
export const alt = 'AI Place 블로그 — 섹터 허브'

export default async function OGImage({ params }: { params: Promise<{ city: string; sector: string }> }) {
  const { city, sector } = await params
  const [cities, sectors, posts] = await Promise.all([
    getCities(),
    getSectors(),
    getBlogPostsBySector(city, sector),
  ])
  const cityName = cities.find(c => c.slug === city)?.name ?? city
  const sectorName = sectors.find(s => s.slug === sector)?.name ?? sector

  return new ImageResponse(
    <OgLayout
      title={`${cityName} · ${sectorName}`}
      subtitle={`${posts.length}편의 ${sectorName} 리서치 글`}
      badge="섹터 허브"
    />,
    { ...size }
  )
}
