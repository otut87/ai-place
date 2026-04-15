'use client'

import { useState } from 'react'
import { updatePlaceStatus, deletePlace } from '@/lib/actions/manage-place'
import { useRouter } from 'next/navigation'

export function PlaceActions({ placeId, status }: { placeId: string; status: string }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleAction(action: 'active' | 'rejected' | 'delete') {
    setLoading(true)
    if (action === 'delete') {
      if (!confirm('정말 삭제하시겠습니까?')) { setLoading(false); return }
      await deletePlace(placeId)
    } else {
      await updatePlaceStatus(placeId, action)
    }
    setLoading(false)
    router.refresh()
  }

  if (loading) return <span className="text-xs text-[#6a6a6a]">처리 중...</span>

  return (
    <div className="flex items-center gap-2">
      {status === 'pending' && (
        <button onClick={() => handleAction('active')} className="text-xs px-3 py-1 rounded-full bg-green-600 text-white hover:bg-green-700">
          승인
        </button>
      )}
      {status === 'pending' && (
        <button onClick={() => handleAction('rejected')} className="text-xs px-3 py-1 rounded-full bg-red-100 text-red-700 hover:bg-red-200">
          반려
        </button>
      )}
      {status === 'active' && (
        <button onClick={() => handleAction('rejected')} className="text-xs px-3 py-1 rounded-full bg-yellow-100 text-yellow-700 hover:bg-yellow-200">
          비활성
        </button>
      )}
      {status === 'rejected' && (
        <button onClick={() => handleAction('active')} className="text-xs px-3 py-1 rounded-full bg-green-100 text-green-700 hover:bg-green-200">
          재활성
        </button>
      )}
      <a href={`/admin/places/${placeId}/edit`} className="text-xs px-2 py-1 text-[#6a6a6a] hover:text-[#222222]">
        수정
      </a>
      <button onClick={() => handleAction('delete')} className="text-xs px-2 py-1 text-[#6a6a6a] hover:text-red-600">
        삭제
      </button>
    </div>
  )
}
