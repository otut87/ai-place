'use client'

// 토픽 큐 사이드바 인라인 삭제 버튼. id(UUID) 로 삭제해 slug 인코딩 불일치 회피.

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { deleteBlogPostById } from '@/lib/actions/blog-edit'
import { useToast } from '@/components/admin/toast'

interface Props {
  id: string
  title: string
}

export function DeleteTopicButton({ id, title }: Props) {
  const router = useRouter()
  const toast = useToast()
  const [pending, start] = useTransition()

  function onClick(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!window.confirm(`"${title}" 토픽을 영구 삭제합니다. 되돌릴 수 없습니다. 계속할까요?`)) return
    start(async () => {
      const r = await deleteBlogPostById(id)
      if (r.success) {
        toast.success('삭제됨')
        router.refresh()
      } else {
        toast.error(r.error ?? '삭제 실패')
      }
    })
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="inline-flex items-center justify-center rounded p-1 text-[#9a9a9a] hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
      title="삭제"
      aria-label={`${title} 삭제`}
    >
      <Trash2 className="h-3 w-3" />
    </button>
  )
}
