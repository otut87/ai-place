'use client'

// T-128 — 프롬프트 버전 활성화 버튼.

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { activatePromptAction } from '@/lib/actions/prompt-template'
import { useToast } from '@/components/admin/toast'

export function ActivatePromptButton({ id, active }: { id: string; active: boolean }) {
  const router = useRouter()
  const toast = useToast()
  const [pending, start] = useTransition()

  if (active) {
    return <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">활성</span>
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        start(async () => {
          const r = await activatePromptAction(id)
          if (r.success) {
            toast.success('이 버전이 활성화되었습니다')
            router.refresh()
          } else {
            toast.error(r.error ?? '활성화 실패')
          }
        })
      }}
      className="inline-flex h-7 items-center rounded-md border border-[#e7e7e7] bg-white px-2 text-xs text-[#191919] hover:bg-[#fafafa] disabled:opacity-50"
    >
      {pending ? '활성화 중…' : '활성화'}
    </button>
  )
}
