'use client'

// 공개 상세 페이지에 배치되는 "신고하기" 버튼 + 모달.
// 누구나 (비로그인 포함) 잘못된 정보·폐업·스팸 등 신고 가능.

import { useState } from 'react'
import { submitReport, type ReportReason } from '@/lib/actions/reports-claims'

const REASON_OPTIONS: Array<{ value: ReportReason; label: string; hint: string }> = [
  { value: 'closed', label: '폐업', hint: '실제로 영업하지 않는 업체입니다.' },
  { value: 'wrong_info', label: '잘못된 정보', hint: '전화·주소·영업시간 등이 틀렸습니다.' },
  { value: 'spam', label: '스팸·광고', hint: '허위 홍보·도배성 콘텐츠입니다.' },
  { value: 'duplicate', label: '중복', hint: '같은 업체가 이미 등록되어 있습니다.' },
  { value: 'inappropriate', label: '부적절', hint: '성인·혐오 등 부적절한 콘텐츠가 포함됩니다.' },
  { value: 'other', label: '기타', hint: '' },
]

interface Props {
  placeId: string
  className?: string
}

export function ReportPlaceButton({ placeId, className }: Props) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<ReportReason>('wrong_info')
  const [detail, setDetail] = useState('')
  const [email, setEmail] = useState('')
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPending(true)
    setError(null)
    setMessage(null)
    const r = await submitReport({ placeId, reason, detail, reporterEmail: email || undefined })
    setPending(false)
    if (r.success) {
      setMessage('신고가 접수되었습니다. 검토 후 조치됩니다.')
      setDetail('')
      setEmail('')
      setTimeout(() => { setOpen(false); setMessage(null) }, 2000)
    } else {
      setError(r.error)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={className ?? 'text-xs text-[#8a8a8a] hover:text-[#c2410c] underline'}
      >
        🚩 신고하기
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
              <h3 className="text-base font-semibold text-[#222222]">업체 정보 신고</h3>
              <button
                type="button"
                onClick={() => !pending && setOpen(false)}
                className="text-lg text-[#9a9a9a] hover:text-[#222222]"
                aria-label="닫기"
              >
                ×
              </button>
            </div>
            <p className="mt-1 text-xs text-[#6a6a6a]">허위 신고는 제한될 수 있습니다.</p>

            <form onSubmit={handleSubmit} className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium">신고 사유</label>
                <div className="space-y-1">
                  {REASON_OPTIONS.map(opt => (
                    <label key={opt.value} className="flex items-start gap-2 cursor-pointer text-sm">
                      <input
                        type="radio"
                        name="reason"
                        value={opt.value}
                        checked={reason === opt.value}
                        onChange={() => setReason(opt.value)}
                        className="mt-1"
                      />
                      <span>
                        <span className="font-medium">{opt.label}</span>
                        {opt.hint && <span className="block text-[11px] text-[#8a8a8a]">{opt.hint}</span>}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium">상세 설명 <span className="text-[10px] text-[#9a9a9a]">(선택, 최대 1000자)</span></label>
                <textarea
                  value={detail}
                  onChange={e => setDetail(e.target.value)}
                  rows={3}
                  maxLength={1000}
                  className="w-full rounded-md border border-[#dddddd] px-3 py-2 text-sm"
                  placeholder="구체적인 상황을 알려주시면 검토가 빨라집니다."
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium">회신 이메일 <span className="text-[10px] text-[#9a9a9a]">(선택)</span></label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full h-10 rounded-md border border-[#dddddd] px-3 text-sm"
                  placeholder="your@email.com"
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
                  className="h-9 rounded-md bg-[#c2410c] px-4 text-sm text-white hover:bg-[#9a2c00] disabled:opacity-50"
                >
                  {pending ? '접수 중...' : '신고하기'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
