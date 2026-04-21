// Preview route group — 스타일·폰트 격리 + noindex.
// 기존 공개 라우트(/, /[city]/... 등) 와는 독립된 디자인 시스템(aip.css) 로 렌더.

import type { Metadata } from 'next'
import '@/styles/aip.css'
import '@/styles/preview-wrap.css'

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
  title: 'AI Place — Preview',
}

export default function PreviewLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500;600&display=swap"
      />
      <div className="aip-preview-root">{children}</div>
    </>
  )
}
