'use client'

// /check 결과 페이지 리드 수집 폼 (T-245 paper/orange aip 리믹스).
// 진단 후 dark CTA 카드 안에 배치.

import { useState, useTransition } from 'react'
import { captureLeadAction } from '@/lib/actions/diagnose'

export function LeadForm({ targetUrl, score }: { targetUrl: string; score: number }) {
  const [email, setEmail] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [sent, setSent] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [pending, start] = useTransition()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    start(async () => {
      const r = await captureLeadAction({ email, businessName, targetUrl, diagnosticScore: score })
      if (r.success) setSent(true)
      else setErr(r.error ?? '제출 실패')
    })
  }

  if (sent) {
    return (
      <p className="ok-msg">
        <span aria-hidden="true">✓</span>
        접수되었습니다. 24시간 내에 개선 가이드와 등록 안내를 <b style={{ color: '#fff' }}>{email}</b> 로 보내드립니다.
      </p>
    )
  }

  return (
    <form onSubmit={submit}>
      <div className="row">
        <input
          type="email"
          placeholder="이메일 주소 *"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
        />
        <input
          type="text"
          placeholder="업체명 (선택)"
          value={businessName}
          onChange={e => setBusinessName(e.target.value)}
        />
      </div>
      <div className="actions">
        <span className="note">개선 가이드 PDF + 업체 등록 안내를 이메일로 받습니다.</span>
        <button type="submit" disabled={pending || !email}>
          {pending ? '제출 중...' : '가이드 받기 →'}
        </button>
      </div>
      {err && <p className="err">{err}</p>}
    </form>
  )
}
