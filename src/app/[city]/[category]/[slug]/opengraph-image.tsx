import { ImageResponse } from 'next/og'
import { getPlaceBySlug } from '@/lib/data.supabase'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function OGImage({ params }: { params: Promise<{ city: string; category: string; slug: string }> }) {
  const { city, category, slug } = await params
  const place = await getPlaceBySlug(city, category, slug)
  const name = place?.name ?? slug

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', backgroundColor: '#ffffff', padding: '60px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: '#008f6b', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '24px', fontWeight: 700 }}>AI</div>
          <span style={{ fontSize: '24px', color: '#6a6a6a' }}>AI Place</span>
        </div>
        <div style={{ fontSize: '56px', fontWeight: 700, color: '#222222', textAlign: 'center', lineHeight: 1.3 }}>{name}</div>
        {place?.rating != null && (
          <div style={{ fontSize: '28px', color: '#6a6a6a', marginTop: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#008f6b' }}>★ {place.rating}</span>
            <span>·</span>
            <span>후기 {place.reviewCount ?? 0}건</span>
          </div>
        )}
      </div>
    ),
    { ...size }
  )
}
