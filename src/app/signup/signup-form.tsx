'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ownerSignupAction } from '@/lib/actions/owner-signup'

export function SignupForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [terms, setTerms] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [verifyMsg, setVerifyMsg] = useState<string | null>(null)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const r = await ownerSignupAction({ email, password, name, phone, termsAgreed: terms })
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
      <div className="text-center">
        <p className="text-sm font-medium text-emerald-700">{verifyMsg}</p>
        <p className="mt-2 text-xs text-[#6a6a6a]">
          인증 후 <a href="/login" className="underline">로그인</a> 해주세요.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-[#484848]">이메일 *</label>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          className="mt-1 h-11 w-full rounded-lg border border-[#dddddd] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#008060]"
          placeholder="your@email.com"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-[#484848]">비밀번호 * <span className="text-[10px] text-[#9a9a9a]">(최소 8자)</span></label>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          minLength={8}
          className="mt-1 h-11 w-full rounded-lg border border-[#dddddd] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#008060]"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-[#484848]">이름 (선택)</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          className="mt-1 h-11 w-full rounded-lg border border-[#dddddd] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#008060]"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-[#484848]">연락처 (선택)</label>
        <input
          type="tel"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          className="mt-1 h-11 w-full rounded-lg border border-[#dddddd] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#008060]"
          placeholder="010-0000-0000"
        />
      </div>

      <label className="flex items-start gap-2 text-xs text-[#484848]">
        <input
          type="checkbox"
          checked={terms}
          onChange={e => setTerms(e.target.checked)}
          className="mt-0.5"
          required
        />
        <span>
          <a href="/terms" className="underline">이용약관</a>과 <a href="/privacy" className="underline">개인정보처리방침</a>에 동의합니다.
        </span>
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="h-11 w-full rounded-lg bg-[#008060] text-sm font-medium text-white transition-colors hover:bg-[#006e52] disabled:opacity-50"
      >
        {pending ? '가입 중...' : '회원가입'}
      </button>
    </form>
  )
}
