'use client'

// Owner 로그인 폼 — login.html 디자인 재현.
// - 아이디 찾기 · 비밀번호 찾기 는 /account/find-id · /account/reset-password 전용 페이지로 분리
// - `?next=` 화이트리스트 복귀 (AUDIT C-4)
// - Supabase 에러 메시지 한글 매핑 (AUDIT P-4)

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { OAuthButtons } from '@/components/auth/oauth-buttons'

const ALLOWED_NEXT_PREFIXES = ['/owner', '/check']

function safeNext(raw: string | null): string {
  if (!raw) return '/owner'
  if (!raw.startsWith('/')) return '/owner'
  if (raw.startsWith('//')) return '/owner'
  const allowed = ALLOWED_NEXT_PREFIXES.some((p) => raw === p || raw.startsWith(p + '/'))
  return allowed ? raw : '/owner'
}

function mapAuthError(msg: string | undefined | null): string {
  if (!msg) return '로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.'
  const m = msg.toLowerCase()
  if (m.includes('invalid login credentials') || m.includes('invalid_credentials')) {
    return '이메일 또는 비밀번호가 맞지 않습니다.'
  }
  if (m.includes('email not confirmed')) {
    return '이메일 인증이 완료되지 않았습니다. 메일함을 확인해 주세요.'
  }
  if (m.includes('too many')) {
    return '로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.'
  }
  return msg
}

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = safeNext(searchParams.get('next'))

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)

  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) {
      setError(mapAuthError(authError.message))
      setPending(false)
      return
    }
    router.push(next)
    router.refresh()
  }

  return (
    <>
      <form onSubmit={handleSubmit} autoComplete="on">
        <div className="field">
          <div className="lbl-row">
            <label htmlFor="login-email">이메일</label>
          </div>
          <div className="in-wrap">
            <input
              id="login-email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="owner@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="field">
          <div className="lbl-row">
            <label htmlFor="login-pw">비밀번호</label>
          </div>
          <div className="in-wrap">
            <input
              id="login-pw"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="options-row">
          <label>
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            로그인 상태 유지
          </label>
          <div className="recovery-links">
            <Link href="/account/find-id">아이디 찾기</Link>
            <span aria-hidden>·</span>
            <Link href="/account/reset-password">비밀번호 찾기</Link>
          </div>
        </div>

        {error && <div className="form-error">{error}</div>}

        <button
          className="submit-btn"
          type="submit"
          disabled={pending || !email || !password}
          style={{ marginTop: 8 }}
        >
          {pending ? '로그인 중...' : '로그인 →'}
        </button>
      </form>

      <div className="divider-or">또는</div>
      <OAuthButtons mode="login" />

      <div className="foot-row">
        처음이신가요? <Link href="/signup">업체 등록하기 →</Link>
      </div>
    </>
  )
}
