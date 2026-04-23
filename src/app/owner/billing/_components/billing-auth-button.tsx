'use client'

// Sprint O-1 / T-204 — Toss 빌링 인증창 호출 Client 컴포넌트.
// - Toss v1 SDK 를 CDN script 로 로드 (npm 의존성 추가 X).
// - 버튼 클릭 → requestBillingAuth('카드') → success/fail URL 로 redirect.

import { useCallback, useEffect, useRef, useState } from 'react'

interface Props {
  /** Toss client key. 없으면 공개 테스트키 사용. */
  clientKey: string
  /** customerKey = customers.id (uuid). */
  customerKey: string
  /** 이미 등록된 카드가 있는지 — 버튼 라벨 분기. */
  hasActiveCard: boolean
}

const TOSS_SDK_SRC = 'https://js.tosspayments.com/v1/payment'

declare global {
  interface Window {
    TossPayments?: (clientKey: string) => {
      requestBillingAuth: (method: string, options: {
        customerKey: string
        successUrl: string
        failUrl: string
      }) => Promise<void>
    }
  }
}

export function BillingAuthButton({ clientKey, customerKey, hasActiveCard }: Props) {
  // SDK 가 이미 로드된 상태로 mount 되면 lazy init 으로 즉시 ready=true —
  // useEffect 에서 setReady(true) 동기 호출을 제거하여 cascading render 방지.
  const [ready, setReady] = useState(() => typeof window !== 'undefined' && !!window.TossPayments)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scriptInjected = useRef(false)

  useEffect(() => {
    if (typeof window === 'undefined' || ready) return
    if (scriptInjected.current) return

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${TOSS_SDK_SRC}"]`)
    if (existing) {
      existing.addEventListener('load', () => setReady(true), { once: true })
      return
    }

    scriptInjected.current = true
    const script = document.createElement('script')
    script.src = TOSS_SDK_SRC
    script.async = true
    script.onload = () => setReady(true)
    script.onerror = () => setError('Toss SDK 로드 실패 — 네트워크 확인 후 새로고침해 주세요.')
    document.head.appendChild(script)
  }, [ready])

  const handleAuth = useCallback(async () => {
    if (!window.TossPayments) {
      setError('Toss SDK 가 아직 준비되지 않았습니다.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const origin = window.location.origin
      const tp = window.TossPayments(clientKey)
      await tp.requestBillingAuth('카드', {
        customerKey,
        successUrl: `${origin}/owner/billing/success`,
        failUrl: `${origin}/owner/billing/fail`,
      })
      // requestBillingAuth 는 redirect 발생 — 여기로 돌아오지 않음.
    } catch (e) {
      setError(e instanceof Error ? e.message : '인증창 호출 실패')
      setBusy(false)
    }
  }, [clientKey, customerKey])

  const label = hasActiveCard ? '카드 변경' : '카드 등록'

  return (
    <>
      <button
        type="button"
        className="btn accent"
        onClick={handleAuth}
        disabled={!ready || busy}
      >
        {busy ? '카드 인증창 여는 중…' : !ready ? '준비 중…' : `${label} →`}
      </button>
      {error && (
        <div className="form-inline-error" style={{ marginTop: 10 }}>
          {error}
        </div>
      )}
    </>
  )
}
