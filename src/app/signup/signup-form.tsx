'use client'

// T-149 — Owner 회원가입 폼. 2026-04-22 Claude Design 반영.
// - 비밀번호 강도 미터 (4단계: 길이·영문·숫자·특수문자)
// - 필수 약관 3개 + 선택 1개 → 필수 전체 체크 시 termsAgreed: true 로 서버 액션 호출
// - 자동결제 고지 강화 (AUDIT I-4)
// - OAuth·추천코드·다국어는 현 플로우 미지원으로 제거

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ownerSignupAction } from '@/lib/actions/owner-signup'
import { checkEmailAvailableAction } from '@/lib/actions/check-email-available'
import { OAuthButtons } from '@/components/auth/oauth-buttons'

type PwCheck = 'len' | 'letter' | 'num' | 'spec'
type EmailState = 'idle' | 'checking' | 'available' | 'taken' | 'invalid'

export function SignupForm() {
  const router = useRouter()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)

  const [termsAge, setTermsAge] = useState(false)
  const [termsTos, setTermsTos] = useState(false)
  const [termsPrivacy, setTermsPrivacy] = useState(false)
  const [termsMarketing, setTermsMarketing] = useState(false)

  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [verifyMsg, setVerifyMsg] = useState<string | null>(null)

  const [emailState, setEmailState] = useState<EmailState>('idle')

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

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  const emailInvalid = email.length > 0 && !emailValid
  const requiredTerms = termsAge && termsTos && termsPrivacy
  const allTerms = requiredTerms && termsMarketing

  // 이메일 중복 체크 — 500ms debounce. invalid 포맷은 서버 호출 X.
  useEffect(() => {
    if (!emailValid) {
      setEmailState(email.length > 0 ? 'invalid' : 'idle')
      return
    }
    setEmailState('checking')
    const timer = setTimeout(async () => {
      const r = await checkEmailAvailableAction(email)
      if (r.status === 'available') setEmailState('available')
      else if (r.status === 'taken') setEmailState('taken')
      else if (r.status === 'invalid') setEmailState('invalid')
      else setEmailState('idle') // error — fail open
    }, 500)
    return () => clearTimeout(timer)
  }, [email, emailValid])

  const canSubmit =
    name.trim().length > 0 &&
    emailValid &&
    emailState !== 'taken' &&
    emailState !== 'checking' &&
    phone.trim().length >= 8 &&
    pwChecks.len &&
    requiredTerms &&
    !pending

  function handleToggleAll(checked: boolean) {
    setTermsAge(checked)
    setTermsTos(checked)
    setTermsPrivacy(checked)
    setTermsMarketing(checked)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setError(null)
    setPending(true)
    const r = await ownerSignupAction({
      email: email.trim(),
      password,
      name: name.trim(),
      phone: phone.trim(),
      termsAgreed: requiredTerms,
    })
    setPending(false)
    if (!r.success) {
      setError(r.error)
      return
    }
    if (r.requiresVerification) {
      setVerifyMsg('이메일로 인증 링크를 보냈습니다. 메일함을 확인해 주세요.')
      return
    }
    router.push('/owner')
    router.refresh()
  }

  if (verifyMsg) {
    return (
      <div className="form-success">
        <b>✅ 가입이 거의 끝났습니다</b>
        <p style={{ margin: '8px 0 0' }}>
          {verifyMsg} 인증 후{' '}
          <Link href="/login" style={{ textDecoration: 'underline' }}>
            로그인
          </Link>{' '}
          해주세요.
        </p>
      </div>
    )
  }

  return (
    <>
      <OAuthButtons mode="signup" />
      <div className="divider-or">또는 이메일로 가입</div>

      <form onSubmit={handleSubmit} autoComplete="on">
      {/* 이름 */}
      <div className="field">
        <div className="lbl-row">
          <label htmlFor="signup-name">대표자 이름</label>
        </div>
        <div className="in-wrap">
          <input
            id="signup-name"
            name="name"
            type="text"
            autoComplete="name"
            placeholder="홍길동"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
      </div>

      {/* 이메일 */}
      <div
        className={`field${emailInvalid || emailState === 'taken' ? ' has-err' : ''}`}
      >
        <div className="lbl-row">
          <label htmlFor="signup-email">
            이메일 <span style={{ color: 'var(--accent)' }}>*</span>
          </label>
          <EmailStatusHint state={emailState} />
        </div>
        <div className="in-wrap">
          <input
            id="signup-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="owner@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={emailState === 'available' ? 'valid' : ''}
            required
          />
          {emailState === 'available' && (
            <span className="in-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </span>
          )}
        </div>
        {emailInvalid && <div className="err" style={{ display: 'block' }}>올바른 이메일 형식이 아닙니다.</div>}
        {emailState === 'taken' && (
          <div className="err" style={{ display: 'block' }}>
            이미 가입된 이메일입니다 ·{' '}
            <Link href="/login" style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'underline' }}>
              로그인
            </Link>
            {' 또는 '}
            <Link href="/account/reset-password" style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'underline' }}>
              비밀번호 찾기
            </Link>
          </div>
        )}
      </div>

      {/* 전화 */}
      <div className="field">
        <div className="lbl-row">
          <label htmlFor="signup-phone">
            휴대폰 번호 <span style={{ color: 'var(--accent)' }}>*</span>
          </label>
          <span className="hint">본인 확인용</span>
        </div>
        <div className="phone-wrap">
          <span className="cc">🇰🇷 +82</span>
          <input
            id="signup-phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            placeholder="10-1234-5678"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
        </div>
      </div>

      {/* 비밀번호 + 강도 */}
      <div className="field">
        <div className="lbl-row">
          <label htmlFor="signup-pw">
            비밀번호 <span style={{ color: 'var(--accent)' }}>*</span>
          </label>
          <span className="hint">8자 이상</span>
        </div>
        <div className="in-wrap">
          <input
            id="signup-pw"
            name="password"
            type={showPw ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
          <button
            type="button"
            className="pw-toggle"
            onClick={() => setShowPw((v) => !v)}
            aria-label={showPw ? '비밀번호 가리기' : '비밀번호 보기'}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
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

      {/* 약관 */}
      <div className="terms">
        <label className="terms-all">
          <input
            type="checkbox"
            checked={allTerms}
            onChange={(e) => handleToggleAll(e.target.checked)}
          />
          <span>약관 전체에 동의합니다</span>
        </label>
        <div className="terms-list">
          <label>
            <input
              type="checkbox"
              checked={termsAge}
              onChange={(e) => setTermsAge(e.target.checked)}
              required
            />
            <span className="req">[필수]</span> 만 14세 이상입니다
          </label>
          <label>
            <input
              type="checkbox"
              checked={termsTos}
              onChange={(e) => setTermsTos(e.target.checked)}
              required
            />
            <span className="req">[필수]</span> 이용약관 동의
            <Link href="/terms">보기</Link>
          </label>
          <label>
            <input
              type="checkbox"
              checked={termsPrivacy}
              onChange={(e) => setTermsPrivacy(e.target.checked)}
              required
            />
            <span className="req">[필수]</span> 개인정보 수집·이용 동의
            <Link href="/privacy">보기</Link>
          </label>
          <label>
            <input
              type="checkbox"
              checked={termsMarketing}
              onChange={(e) => setTermsMarketing(e.target.checked)}
            />
            <span className="opt">[선택]</span> 마케팅 정보 수신 (이메일·SMS)
          </label>
        </div>
      </div>

      {/* 파일럿·자동결제 고지 — AUDIT I-4 */}
      <div className="pilot-note">
        <b>가입 후 30일 파일럿 무료</b>로 시작됩니다. 이후 월 9,900원 자동 결제는{' '}
        <b>카드 등록을 완료한 경우에만</b> 진행되며, 언제든{' '}
        <Link href="/owner/billing/cancel" style={{ textDecoration: 'underline' }}>
          해지
        </Link>{' '}
        가능합니다.
      </div>

      {error && <div className="form-error">{error}</div>}

      <button
        className="submit-btn"
        type="submit"
        disabled={!canSubmit}
        style={{ marginTop: 16 }}
      >
        {pending ? '가입 중...' : '무료로 시작하기'}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </button>

      <div className="foot-row">
        이미 계정이 있으신가요? <Link href="/login">로그인 →</Link>
      </div>
    </form>
    </>
  )
}

function EmailStatusHint({ state }: { state: EmailState }) {
  if (state === 'checking') {
    return <span className="hint" style={{ color: 'var(--muted)' }}>확인 중…</span>
  }
  if (state === 'available') {
    return <span className="hint" style={{ color: 'var(--good)' }}>사용 가능</span>
  }
  if (state === 'taken') {
    return <span className="hint" style={{ color: '#b42318' }}>이미 사용 중</span>
  }
  return <span className="hint">업무용 권장</span>
}
