'use client'

import Script from 'next/script'
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { isAnalyticsSuppressedPath } from '@/lib/analytics/suppressed-paths'

const GA_ID = process.env.NEXT_PUBLIC_GA_ID

/** GA4 스크립트 + AI referrer 자동 추적
 *
 * T-060:
 * - strategy 를 lazyOnload 로 낮춰 main thread 점유 제거 (GA 503 timeout 상황에서도 메인 렌더 차단 안 됨)
 * - /admin/*, /owner/* 경로에서는 Analytics 자체를 mount 하지 않음 (운영자 트래픽은 지표에서 제외)
 */
export function Analytics() {
  const pathname = usePathname()
  const suppressed = isAnalyticsSuppressedPath(pathname ?? '/')

  useEffect(() => {
    if (!GA_ID || typeof window === 'undefined' || suppressed) return

    // AI referrer 감지 및 이벤트 전송
    const referrer = document.referrer
    const aiSources = [
      { domain: 'chatgpt.com', name: 'chatgpt' },
      { domain: 'chat.openai.com', name: 'chatgpt' },
      { domain: 'perplexity.ai', name: 'perplexity' },
      { domain: 'claude.ai', name: 'claude' },
      { domain: 'gemini.google.com', name: 'gemini' },
      { domain: 'copilot.microsoft.com', name: 'copilot' },
    ]

    const aiSource = aiSources.find(s => referrer.includes(s.domain))
    if (aiSource) {
      window.gtag?.('event', 'ai_referral', {
        ai_source: aiSource.name,
        referrer_url: referrer,
        landing_page: window.location.pathname,
      })
    }
  }, [suppressed])

  if (!GA_ID || suppressed) return null

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="lazyOnload" />
      <Script id="ga4-init" strategy="lazyOnload">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_ID}');
        `}
      </Script>
    </>
  )
}

/** 전화 클릭 이벤트 추적 */
export function trackPhoneClick(businessName: string) {
  window.gtag?.('event', 'phone_click', {
    business_name: businessName,
    page_path: window.location.pathname,
    referrer: document.referrer,
  })
}
