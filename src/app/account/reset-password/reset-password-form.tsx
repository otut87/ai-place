'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

function mapError(msg: string | undefined | null): string {
  if (!msg) return '재설정 메일 발송에 실패했습니다. 잠시 후 다시 시도해 주세요.'
  const m = msg.toLowerCase()
  if (m.includes('rate limit') || m.includes('too many')) {
    return '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.'
  }
  if (m.includes('invalid email')) {
    return '올바른 이메일 주소를 입력해 주세요.'
  }
  return msg
}

export function ResetPasswordForm() {
  const [email, setEmail] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const supabase = createClient()
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/account/reset-password/confirm`,
    })
    setPending(false)
    if (resetError) {
      setError(mapError(resetError.message))
      return
    }
    setSent(true)
  }

  if (sent) {
    return (
      <div className="result-card">
        <div className="result-icon ok">✉️</div>
        <h2>이메일을 확인해 주세요</h2>
        <p className="result-hint">
          <b>{email}</b> 으로 재설정 링크를 보냈습니다.<br />
          메일함을 확인하고 링크를 클릭해 주세요.
        </p>
        <div className="result-note">
          <strong>메일이 도착하지 않았나요?</strong>
          <ul>
            <li>스팸함을 확인해 주세요.</li>
            <li>발송까지 최대 1~2분 소요될 수 있습니다.</li>
            <li>발신자: <code>noreply@mail.app.supabase.io</code></li>
          </ul>
        </div>
        <div className="result-actions">
          <button
            type="button"
            className="submit-btn ghost"
            onClick={() => {
              setSent(false)
              setEmail('')
              setError(null)
            }}
          >
            다른 이메일로 재전송
          </button>
          <Link href="/login" className="submit-btn">
            로그인으로 돌아가기
          </Link>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} autoComplete="on">
      <div className="field">
        <div className="lbl-row">
          <label htmlFor="reset-email">이메일</label>
        </div>
        <div className="in-wrap">
          <input
            id="reset-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="owner@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
        </div>
      </div>

      {error && <div className="form-error">{error}</div>}

      <button
        className="submit-btn"
        type="submit"
        disabled={pending || !email.trim()}
        style={{ marginTop: 16 }}
      >
        {pending ? '전송 중...' : '재설정 링크 받기 →'}
      </button>

      <div className="foot-row">
        이메일을 잊으셨나요?{' '}
        <Link href="/account/find-id">아이디 찾기</Link>
      </div>
    </form>
  )
}
