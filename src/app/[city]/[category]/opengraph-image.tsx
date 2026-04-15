import { ImageResponse } from 'next/og'
import { getCities, getCategories, getPlaces } from '@/lib/data.supabase'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function OGImage({ params }: { params: Promise<{ city: string; category: string }> }) {
  const { city, category } = await params
  const cities = await getCities()
  const categories = await getCategories()
  const places = await getPlaces(city, category)

  const cityObj = cities.find(c => c.slug === city)
  const catObj = categories.find(c => c.slug === category)
  const cityName = cityObj?.name ?? city
  const catName = catObj?.name ?? category

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#ffffff',
          padding: '60px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '24px',
          }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              backgroundColor: '#008f6b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '24px',
              fontWeight: 700,
            }}
          >
            AI
          </div>
          <span style={{ fontSize: '24px', color: '#6a6a6a' }}>AI Place</span>
        </div>
        <div
          style={{
            fontSize: '56px',
            fontWeight: 700,
            color: '#222222',
            textAlign: 'center',
            lineHeight: 1.3,
          }}
        >
          {cityName} {catName} 추천
        </div>
        <div
          style={{
            fontSize: '28px',
            color: '#6a6a6a',
            marginTop: '16px',
          }}
        >
          {places.length}곳의 업체 정보 · 2026년 업데이트
        </div>
      </div>
    ),
    { ...size }
  )
}
