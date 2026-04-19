'use client'

// T-080 UI — "AI 자동완성 등록" 버튼.
// 업체명 한 줄만으로 pipeline_jobs 에 enqueue. 이후 워커가 수집→생성→검수큐 배치.

import { useTransition } from 'react'
import { Sparkles } from 'lucide-react'
import { enqueuePipelineJob } from '@/lib/actions/trigger-pipeline'
import { useToast } from '@/components/admin/toast'

interface Props {
  placeName: string
  city: string
  category: string
  address: string
}

export function AutofillEnqueueButton({ placeName, city, category, address }: Props) {
  const [pending, start] = useTransition()
  const toast = useToast()

  const ready = placeName.trim().length >= 2 && !!city && !!category

  function run() {
    if (!ready) {
      toast.error('업체명 · 도시 · 업종은 입력되어야 합니다.')
      return
    }
    start(async () => {
      const r = await enqueuePipelineJob({
        jobType: 'collect',
        targetType: 'place',
        payload: { placeName: placeName.trim(), city, category, address },
      })
      if (r.success) {
        toast.success('AI 자동완성이 큐에 등록되었습니다. 검수 큐에서 확인하세요.')
      } else {
        toast.error(r.error ?? '큐 등록 실패')
      }
    })
  }

  return (
    <button
      type="button"
      onClick={run}
      disabled={!ready || pending}
      className="mt-2 inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-lg border border-[#dddddd] bg-white text-sm font-medium text-[#191919] transition-colors hover:border-[#b6b6b6] hover:bg-[#fafafa] disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Sparkles className="h-4 w-4 text-[#00a67c]" />
      {pending ? 'AI 큐 등록 중…' : 'AI 자동완성으로 등록 (수집→생성→검수)'}
    </button>
  )
}
