// T-120 — 공용 OG 이미지 템플릿.
// 철학: "OG 이미지 정보는 본문 텍스트로 반드시 중복". 이미지 자체는 보조 역할.
// 모든 이미지는 1200×630 고정, 브랜드 일관성 유지.

export const OG_SIZE = { width: 1200, height: 630 } as const

interface OgLayoutProps {
  title: string
  subtitle?: string
  badge?: string
}

/** 브랜드 헤더 (좌상단) + H1 + 보조문구 + 우상단 배지 */
export function OgLayout({ title, subtitle, badge }: OgLayoutProps) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#ffffff',
        padding: '60px',
        position: 'relative',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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

      {badge && (
        <div
          style={{
            position: 'absolute',
            top: '60px',
            right: '60px',
            backgroundColor: '#e6f4ef',
            color: '#008060',
            padding: '8px 16px',
            borderRadius: '999px',
            fontSize: '20px',
            fontWeight: 600,
            display: 'flex',
          }}
        >
          {badge}
        </div>
      )}

      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: '16px',
        }}
      >
        <div
          style={{
            fontSize: '56px',
            fontWeight: 700,
            color: '#222222',
            lineHeight: 1.2,
          }}
        >
          {title}
        </div>
        {subtitle && (
          <div style={{ fontSize: '28px', color: '#6a6a6a', lineHeight: 1.4 }}>
            {subtitle}
          </div>
        )}
      </div>

      <div style={{ fontSize: '18px', color: '#8c8c8c', display: 'flex' }}>
        aiplace.kr
      </div>
    </div>
  )
}
