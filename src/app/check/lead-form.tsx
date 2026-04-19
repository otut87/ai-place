'use client'

// T-139 — 리드 수집 폼 (진단 결과 페이지 CTA 영역).

import { useState, useTransition } from 'react'
import { Send, CheckCircle2 } from 'lucide-react'
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
      <div className="flex items-start gap-2 text-sm text-white">
        <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-200" />
        <span>
          접수되었습니다. 24시간 내에 개선 가이드와 등록 안내를 <strong>{email}</strong> 로 보내드립니다.
        </span>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          type="email"
          placeholder="이메일 주소 *"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          className="h-10 rounded-md border border-white/20 bg-white/10 px-3 text-sm text-white placeholder:text-white/60 focus:border-white focus:outline-none"
        />
        <input
          type="text"
          placeholder="업체명 (선택)"
          value={businessName}
          onChange={e => setBusinessName(e.target.value)}
          className="h-10 rounded-md border border-white/20 bg-white/10 px-3 text-sm text-white placeholder:text-white/60 focus:border-white focus:outline-none"
        />
      </div>
      <div className="flex items-center justify-between">
        <p className="text-xs text-emerald-100">
          개선 가이드 PDF + 업체 등록 안내를 이메일로 받습니다.
        </p>
        <button
          type="submit"
          disabled={pending || !email}
          className="inline-flex h-10 items-center gap-1.5 rounded-md bg-white px-4 text-sm font-medium text-[#008060] hover:bg-emerald-50 disabled:opacity-60"
        >
          <Send className="h-3.5 w-3.5" />
          {pending ? '제출 중…' : '가이드 받기'}
        </button>
      </div>
      {err && <p className="text-xs text-red-100">{err}</p>}
    </form>
  )
}
