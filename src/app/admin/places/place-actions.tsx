'use client'

import { useState } from 'react'
import { updatePlaceStatus, deletePlace } from '@/lib/actions/manage-place'
import { useRouter } from 'next/navigation'
import { ConfirmNameModal } from '@/components/admin/confirm-name-modal'
import { useToast } from '@/components/admin/toast'

export function PlaceActions({ placeId, placeName, status }: { placeId: string; placeName: string; status: string }) {
  const [loading, setLoading] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const router = useRouter()
  const toast = useToast()

  async function runStatus(next: 'active' | 'rejected') {
    setLoading(true)
    try {
      const result = await updatePlaceStatus(placeId, next)
      if (result.success) {
        toast.success(next === 'active' ? '승인 처리되었습니다.' : '반려 처리되었습니다.')
      } else {
        toast.error(result.error ?? '처리 실패')
      }
    } catch (e) {
      toast.error(String((e as Error)?.message ?? e))
    }
    setLoading(false)
    router.refresh()
  }

  async function runDelete() {
    setLoading(true)
    setConfirmOpen(false)
    try {
      const result = await deletePlace(placeId)
      if (result.success) {
        toast.success(`${placeName} 삭제됨`)
      } else {
        toast.error(result.error ?? '삭제 실패')
      }
    } catch (e) {
      toast.error(String((e as Error)?.message ?? e))
    }
    setLoading(false)
    router.refresh()
  }

  if (loading) return <span className="text-xs text-[#6a6a6a]">처리 중...</span>

  return (
    <div className="flex items-center gap-2">
      {status === 'pending' && (
        <>
          <button onClick={() => runStatus('active')} className="text-xs px-3 py-1 rounded-full bg-green-600 text-white hover:bg-green-700">
            승인
          </button>
          <button onClick={() => runStatus('rejected')} className="text-xs px-3 py-1 rounded-full bg-red-100 text-red-700 hover:bg-red-200">
            반려
          </button>
        </>
      )}
      {status === 'active' && (
        <button onClick={() => runStatus('rejected')} className="text-xs px-3 py-1 rounded-full bg-yellow-100 text-yellow-700 hover:bg-yellow-200">
          비활성
        </button>
      )}
      {status === 'rejected' && (
        <button onClick={() => runStatus('active')} className="text-xs px-3 py-1 rounded-full bg-green-100 text-green-700 hover:bg-green-200">
          재활성
        </button>
      )}
      <a href={`/admin/places/${placeId}/edit`} className="text-xs px-2 py-1 text-[#6a6a6a] hover:text-[#222222]">
        수정
      </a>
      <button onClick={() => setConfirmOpen(true)} className="text-xs px-2 py-1 text-[#6a6a6a] hover:text-red-600">
        삭제
      </button>

      <ConfirmNameModal
        open={confirmOpen}
        expectedName={placeName}
        title="업체 삭제"
        description="이 작업은 되돌릴 수 없습니다. 업체명을 정확히 입력해 주세요."
        onCancel={() => setConfirmOpen(false)}
        onConfirm={runDelete}
      />
    </div>
  )
}
