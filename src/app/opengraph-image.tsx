import { ImageResponse } from 'next/og'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function OGImage() {
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
        <div style={{ width: '80px', height: '80px', borderRadius: '20px', backgroundColor: '#008f6b', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '40px', fontWeight: 700, marginBottom: '32px' }}>AI</div>
        <div style={{ fontSize: '56px', fontWeight: 700, color: '#222222', textAlign: 'center', lineHeight: 1.3 }}>
          AI Place
        </div>
        <div style={{ fontSize: '28px', color: '#6a6a6a', marginTop: '16px', textAlign: 'center' }}>
          AI가 추천하는 우리 동네 업체
        </div>
      </div>
    ),
    { ...size }
  )
}
