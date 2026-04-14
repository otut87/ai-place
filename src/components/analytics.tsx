'use client'

import Script from 'next/script'
import { useEffect } from 'react'

const GA_ID = process.env.NEXT_PUBLIC_GA_ID

/** GA4 스크립트 + AI referrer 자동 추적 */
export function Analytics() {
  useEffect(() => {
    if (!GA_ID || typeof window === 'undefined') return

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
  }, [])

  if (!GA_ID) return null

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
      <Script id="ga4-init" strategy="afterInteractive">
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
