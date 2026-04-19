'use client'

// T-140 / T-141 — AI 인용 테스트 실행 버튼 (구독자 + 주 1회 제한 UI 처리).

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, Loader2, Lock, Clock } from 'lucide-react'
import { runCitationTestAction, type CitationTestOutcome } from '@/lib/actions/citation-test'

interface Props {
  placeId: string
  subActive: boolean
  rateAllowed: boolean
  remainingHours: number
  lastRunAt: string | null
}

export function CitationTestButton({ placeId, subActive, rateAllowed, remainingHours, lastRunAt }: Props) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [result, setResult] = useState<CitationTestOutcome | null>(null)

  if (!subActive) {
    return (
      <div className="rounded-md border border-[#e5e7eb] bg-[#fafafa] p-3 text-[11px] text-[#6a6a6a]">
        <div className="mb-1 flex items-center gap-1 font-medium text-[#191919]">
          <Lock className="h-3 w-3" /> 구독자 전용
        </div>
        AI 인용 실측 테스트는 활성 구독 고객만 이용할 수 있습니다.
      </div>
    )
  }

  if (!rateAllowed) {
    return (
      <div className="rounded-md border border-[#e5e7eb] bg-[#fafafa] p-3 text-[11px] text-[#6a6a6a]">
        <div className="mb-1 flex items-center gap-1 font-medium text-[#191919]">
          <Clock className="h-3 w-3" /> 다음 테스트까지 {remainingHours}시간
        </div>
        {lastRunAt && <>마지막 실행: {new Date(lastRunAt).toLocaleString('ko-KR')}</>}
      </div>
    )
  }

  function run() {
    start(async () => {
      const r = await runCitationTestAction(placeId)
      setResult(r)
      if (r.success) {
        router.refresh()
      }
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md bg-[#008060] px-3 text-xs text-white hover:bg-[#006b4f] disabled:opacity-60"
      >
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
        {pending ? '실측 중 (~1~2분)…' : 'AI 인용 테스트 실행'}
      </button>
      <p className="mt-1.5 text-[10px] text-[#9a9a9a]">
        ChatGPT / Claude / Gemini × 3개 쿼리 = 9회 호출. 주 1회 제한.
      </p>

      {result && !result.success && (
        <p className="mt-2 rounded-md bg-red-50 p-2 text-[11px] text-red-700">{result.error}</p>
      )}
      {result && result.success && (
        <p className="mt-2 rounded-md bg-emerald-50 p-2 text-[11px] text-emerald-800">
          완료: {result.citedCount}/{result.resultsCount} 인용 ({Math.round(result.citationRate * 100)}%)
        </p>
      )}
    </>
  )
}
