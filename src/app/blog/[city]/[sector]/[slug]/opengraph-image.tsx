import { ImageResponse } from 'next/og'
import { getBlogPost } from '@/lib/blog/data.supabase'
import { OgLayout, OG_SIZE } from '@/lib/og-template'

export const size = OG_SIZE
export const contentType = 'image/png'
export const alt = 'AI Place 블로그 글'

export default async function OGImage({
  params,
}: {
  params: Promise<{ city: string; sector: string; slug: string }>
}) {
  const { city, sector, slug } = await params
  const post = await getBlogPost(city, sector, slug)
  const title = post?.title ?? slug
  const subtitle = post?.summary ?? 'AI Place 리서치'

  return new ImageResponse(
    <OgLayout title={title} subtitle={subtitle} badge="블로그" />,
    { ...size }
  )
}
