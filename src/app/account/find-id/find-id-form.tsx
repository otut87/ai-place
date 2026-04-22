'use client'

import { useState } from 'react'
import Link from 'next/link'
import { findEmailByPhoneAction } from '@/lib/actions/find-email'

export function FindIdForm() {
  const [phone, setPhone] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [maskedEmail, setMaskedEmail] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setMaskedEmail(null)
    setPending(true)
    const r = await findEmailByPhoneAction(phone)
    setPending(false)
    if (!r.success) {
      setError(r.error)
      return
    }
    setMaskedEmail(r.maskedEmail)
  }

  if (maskedEmail) {
    return (
      <div className="result-card">
        <div className="result-icon ok">✓</div>
        <h2>이메일을 찾았습니다</h2>
        <div className="masked-email">{maskedEmail}</div>
        <p className="result-hint">
          보안을 위해 일부만 가려서 표시됩니다. 전체 이메일이 기억나지 않으시면
          <br />가입 당시 받으신 이메일을 확인해 주세요.
        </p>
        <div className="result-actions">
          <Link href="/login" className="submit-btn">
            로그인 하러 가기 →
          </Link>
          <Link href="/account/reset-password" className="submit-btn ghost">
            비밀번호 찾기
          </Link>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} autoComplete="on">
      <div className="field">
        <div className="lbl-row">
          <label htmlFor="find-phone">휴대폰 번호</label>
          <span className="hint">가입 시 입력한 번호</span>
        </div>
        <div className="phone-wrap">
          <span className="cc">🇰🇷 +82</span>
          <input
            id="find-phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            placeholder="10-1234-5678"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            autoFocus
          />
        </div>
      </div>

      {error && <div className="form-error">{error}</div>}

      <button
        className="submit-btn"
        type="submit"
        disabled={pending || !phone.trim()}
        style={{ marginTop: 16 }}
      >
        {pending ? '조회 중...' : '이메일 찾기 →'}
      </button>

      <div className="foot-row">
        이메일을 이미 알고 계시나요? <Link href="/login">로그인 →</Link>
      </div>
    </form>
  )
}
