'use client'

// 소유권 이관 문의 버튼 + 모달.
// "이미 등록됨" 카드에서 "이 업체 내 소유예요" 클릭 시 사용.

import { useState } from 'react'
import { submitClaim } from '@/lib/actions/reports-claims'

interface Props {
  placeId: string
  placeName: string
  className?: string
  triggerLabel?: string
}

export function ClaimPlaceButton({ placeId, placeName, className, triggerLabel }: Props) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [phone, setPhone] = useState('')
  const [evidenceUrl, setEvidenceUrl] = useState('')
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPending(true)
    setError(null)
    setMessage(null)
    const r = await submitClaim({ placeId, reason, contactPhone: phone, evidenceUrl: evidenceUrl || undefined })
    setPending(false)
    if (r.success) {
      setMessage('문의가 접수되었습니다. 관리자가 검토 후 연락드립니다.')
      setTimeout(() => { setOpen(false); setMessage(null) }, 2500)
    } else {
      setError(r.error)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(true) }}
        className={className ?? 'text-xs text-[#4c1d95] underline'}
      >
        {triggerLabel ?? '이 업체 내 소유예요 — 소유권 이관 문의'}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !pending && setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-[#222222]">소유권 이관 문의</h3>
              <button
                type="button"
                onClick={() => !pending && setOpen(false)}
                className="text-lg text-[#9a9a9a] hover:text-[#222222]"
                aria-label="닫기"
              >
                ×
              </button>
            </div>
            <p className="mt-1 text-xs text-[#6a6a6a]">
              <strong className="text-[#222222]">{placeName}</strong> 에 대한 소유권을 주장합니다. 관리자 검토 후 이관됩니다.
            </p>

            <form onSubmit={handleSubmit} className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium">본인 확인 가능한 사유 <span className="text-[10px] text-[#9a9a9a]">(예: 대표자 본인, 사업자등록증 보유, 대리인 위임 등)</span></label>
                <textarea
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  rows={4}
                  maxLength={2000}
                  required
                  className="w-full rounded-md border border-[#dddddd] px-3 py-2 text-sm"
                  placeholder="소유권을 증명할 수 있는 구체적 사유를 적어주세요."
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium">연락처 <span className="text-red-500">*</span></label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  required
                  className="w-full h-10 rounded-md border border-[#dddddd] px-3 text-sm"
                  placeholder="010-0000-0000"
                />
                <p className="mt-1 text-[10px] text-[#9a9a9a]">관리자가 확인 연락드립니다.</p>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium">증빙 파일 URL <span className="text-[10px] text-[#9a9a9a]">(선택 — 사업자등록증 등)</span></label>
                <input
                  type="url"
                  value={evidenceUrl}
                  onChange={e => setEvidenceUrl(e.target.value)}
                  className="w-full h-10 rounded-md border border-[#dddddd] px-3 text-sm"
                  placeholder="https://..."
                />
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}
              {message && <p className="text-sm text-emerald-700">{message}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={pending}
                  className="h-9 rounded-md border border-[#dddddd] px-4 text-sm text-[#484848] hover:bg-[#f2f2f2]"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="h-9 rounded-md bg-[#4c1d95] px-4 text-sm text-white hover:bg-[#3d1671] disabled:opacity-50"
                >
                  {pending ? '접수 중...' : '문의 접수'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
