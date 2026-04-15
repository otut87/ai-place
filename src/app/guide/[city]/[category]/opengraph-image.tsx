import { ImageResponse } from 'next/og'
import { getGuidePage } from '@/lib/data.supabase'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function OGImage({ params }: { params: Promise<{ city: string; category: string }> }) {
  const { city, category } = await params
  const guide = await getGuidePage(city, category)
  const title = guide?.title ?? '선택 가이드'

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
          backgroundColor: '#f2f2f2',
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
          <span style={{ fontSize: '24px', color: '#6a6a6a' }}>AI Place 가이드</span>
        </div>
        <div
          style={{
            fontSize: '48px',
            fontWeight: 700,
            color: '#222222',
            textAlign: 'center',
            lineHeight: 1.3,
            maxWidth: '900px',
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: '24px',
            color: '#6a6a6a',
            marginTop: '16px',
          }}
        >
          전문 분야 · 비용 · 진료 시간 종합 비교
        </div>
      </div>
    ),
    { ...size }
  )
}
