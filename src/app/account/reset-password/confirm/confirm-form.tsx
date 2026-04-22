'use client'

// Supabase recovery 세션 감지 → 새 비밀번호 설정.
// 브라우저가 #access_token=... 를 받으면 supabase-js 클라이언트가 자동으로
// 세션을 세팅하고 PASSWORD_RECOVERY 이벤트를 발행한다.

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type PwCheck = 'len' | 'letter' | 'num' | 'spec'
type ReadyState = 'loading' | 'ready' | 'invalid'

export function ConfirmForm() {
  const router = useRouter()
  const [ready, setReady] = useState<ReadyState>('loading')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pwChecks = useMemo<Record<PwCheck, boolean>>(
    () => ({
      len: password.length >= 8,
      letter: /[a-zA-Z]/.test(password),
      num: /\d/.test(password),
      spec: /[^a-zA-Z0-9]/.test(password),
    }),
    [password],
  )
  const pwScore = Object.values(pwChecks).filter(Boolean).length
  const pwMatch = confirm.length > 0 && password === confirm
  const canSubmit = pwChecks.len && pwMatch && !pending

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false

    // 즉시 세션 체크 (supabase-js 가 이미 hash 를 처리했을 수 있음)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return
      if (session) {
        setReady('ready')
        return
      }
      // 아직이면 한 번 더 기다려본다 (최대 1.5초)
      setTimeout(() => {
        if (cancelled) return
        supabase.auth.getSession().then(({ data: { session: s2 } }) => {
          if (!cancelled) setReady(s2 ? 'ready' : 'invalid')
        })
      }, 1500)
    })

    // PASSWORD_RECOVERY 이벤트 구독
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' && session) setReady('ready')
    })

    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!pwChecks.len) {
      setError('비밀번호는 8자 이상이어야 합니다.')
      return
    }
    if (password !== confirm) {
      setError('비밀번호가 일치하지 않습니다.')
      return
    }
    setPending(true)
    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setPending(false)
      const m = updateError.message.toLowerCase()
      if (m.includes('same password') || m.includes('new password should')) {
        setError('기존 비밀번호와 같을 수 없습니다. 다른 비밀번호를 사용해 주세요.')
      } else {
        setError(updateError.message)
      }
      return
    }
    // 성공 — 세션 유지된 상태로 /owner 로 이동
    router.push('/owner')
    router.refresh()
  }

  if (ready === 'loading') {
    return (
      <div className="result-card">
        <p style={{ color: 'var(--muted)', textAlign: 'center', margin: 0 }}>
          링크를 확인하는 중입니다...
        </p>
      </div>
    )
  }

  if (ready === 'invalid') {
    return (
      <div className="result-card">
        <div className="result-icon err">!</div>
        <h2>유효하지 않거나 만료된 링크</h2>
        <p className="result-hint">
          비밀번호 재설정 링크는 발송 후 <b>1시간</b> 동안만 유효합니다.<br />
          새 링크를 받아 다시 시도해 주세요.
        </p>
        <div className="result-actions">
          <Link href="/account/reset-password" className="submit-btn">
            새 링크 요청하기
          </Link>
          <Link href="/login" className="submit-btn ghost">
            로그인으로
          </Link>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} autoComplete="on">
      <div className="field">
        <div className="lbl-row">
          <label htmlFor="new-pw">새 비밀번호</label>
          <span className="hint">8자 이상</span>
        </div>
        <div className="in-wrap">
          <input
            id="new-pw"
            name="new-password"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
            autoFocus
          />
        </div>
        <div className="pw-meter" data-s={pwScore}>
          <span />
          <span />
          <span />
          <span />
        </div>
        <div className="pw-checks">
          <span className={pwChecks.len ? 'ok' : ''}>8자 이상</span>
          <span className={pwChecks.letter ? 'ok' : ''}>영문</span>
          <span className={pwChecks.num ? 'ok' : ''}>숫자</span>
          <span className={pwChecks.spec ? 'ok' : ''}>특수문자</span>
        </div>
      </div>

      <div className={`field${confirm && !pwMatch ? ' has-err' : ''}`}>
        <div className="lbl-row">
          <label htmlFor="confirm-pw">비밀번호 확인</label>
        </div>
        <div className="in-wrap">
          <input
            id="confirm-pw"
            name="confirm-password"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            minLength={8}
            required
          />
        </div>
        <div className="err">비밀번호가 일치하지 않습니다.</div>
      </div>

      {error && <div className="form-error">{error}</div>}

      <button
        className="submit-btn"
        type="submit"
        disabled={!canSubmit}
        style={{ marginTop: 16 }}
      >
        {pending ? '변경 중...' : '비밀번호 변경 →'}
      </button>
    </form>
  )
}
