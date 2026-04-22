'use client'

// Owner 로그인/가입용 OAuth 버튼 — 실제 디자인 파일의 3개 프로바이더(네이버·카카오·Google).
// Supabase OAuth provider 는 미설정 상태이므로 UI 만 유지하고 클릭 시 안내 토스트.
// 추후 provider 설정 후 handleClick 만 signInWithOAuth 로 교체하면 됨.

import { useState } from 'react'

type Provider = 'naver' | 'kakao' | 'google'

const LABELS: Record<Provider, string> = {
  naver: '네이버로 계속하기',
  kakao: '카카오로 계속하기',
  google: 'Google로 계속하기',
}

export function OAuthButtons({ mode = 'login' }: { mode?: 'login' | 'signup' }) {
  const [toast, setToast] = useState<string | null>(null)

  function handleClick(provider: Provider) {
    // TODO: Supabase OAuth provider 설정 후 supabase.auth.signInWithOAuth({ provider }) 로 교체.
    setToast(`${LABELS[provider].replace('계속하기', '로그인')}은 곧 제공 예정입니다.`)
    window.setTimeout(() => setToast(null), 3500)
  }

  const verb = mode === 'signup' ? '시작하기' : '계속하기'

  return (
    <>
      <div className="oauth">
        <button className="n" type="button" onClick={() => handleClick('naver')}>
          <svg viewBox="0 0 18 18" fill="#fff" aria-hidden>
            <path d="M12.3 0v7.5L5.7 0H0v18h5.7v-7.5L12.3 18H18V0z" />
          </svg>
          네이버로 {verb}
        </button>
        <button className="k" type="button" onClick={() => handleClick('kakao')}>
          <svg viewBox="0 0 18 18" fill="#000" aria-hidden>
            <path d="M9 1C4 1 0 4.2 0 8.1c0 2.5 1.7 4.8 4.3 6L3.2 18l4.3-2.4c.5.1 1 .1 1.5.1 5 0 9-3.2 9-7.1S14 1 9 1z" />
          </svg>
          카카오로 {verb}
        </button>
        <button type="button" onClick={() => handleClick('google')}>
          <svg viewBox="0 0 24 24" aria-hidden>
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A10.99 10.99 0 0 0 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.99 10.99 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Google로 {verb}
        </button>
      </div>
      {toast && <div className="oauth-toast">{toast}</div>}
    </>
  )
}
