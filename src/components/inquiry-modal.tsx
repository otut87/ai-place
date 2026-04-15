'use client'

import { useState } from 'react'

export function InquiryButton({ className, children }: { className?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button onClick={() => setOpen(true)} className={className}>
        {children}
      </button>
      {open && <InquiryModal onClose={() => setOpen(false)} />}
    </>
  )
}

function InquiryModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const canSubmit = name.trim() && phone.trim() && agreed

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    // TODO: 다음 세션에서 어드민 연결
    setSubmitted(true)
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative bg-white rounded-[20px] w-full max-w-[480px] p-6 sm:p-8"
        style={{ boxShadow: 'var(--shadow-card)' }}
        onClick={e => e.stopPropagation()}
      >
        {submitted ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-full bg-[#008060] flex items-center justify-center mx-auto mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <path d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-[#222222]">문의가 접수되었습니다</h3>
            <p className="mt-2 text-sm text-[#6a6a6a]">담당자가 확인 후 연락드리겠습니다.</p>
            <button
              onClick={onClose}
              className="mt-6 h-10 px-5 rounded-lg bg-[#008060] text-white text-sm font-medium hover:bg-[#006b4f] transition-colors"
            >
              확인
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-[#222222]">업체 등록 문의</h3>
              <button onClick={onClose} className="p-1 rounded-lg hover:bg-[#f2f2f2] transition-colors" aria-label="닫기">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6a6a6a" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="inquiry-name" className="block text-sm font-medium text-[#222222] mb-1">이름</label>
                <input
                  id="inquiry-name"
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="홍길동"
                  className="w-full h-10 px-3 rounded-lg border border-[#c1c1c1] text-sm text-[#222222] placeholder:text-[#c1c1c1] focus:outline-none focus:border-[#008060]"
                  required
                />
              </div>

              <div>
                <label htmlFor="inquiry-phone" className="block text-sm font-medium text-[#222222] mb-1">연락처</label>
                <input
                  id="inquiry-phone"
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="010-0000-0000"
                  className="w-full h-10 px-3 rounded-lg border border-[#c1c1c1] text-sm text-[#222222] placeholder:text-[#c1c1c1] focus:outline-none focus:border-[#008060]"
                  required
                />
              </div>

              <div>
                <label htmlFor="inquiry-message" className="block text-sm font-medium text-[#222222] mb-1">문의 내용 <span className="text-[#c1c1c1] font-normal">(선택)</span></label>
                <textarea
                  id="inquiry-message"
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="업체명, 업종 등을 알려주시면 빠른 안내가 가능합니다."
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-[#c1c1c1] text-sm text-[#222222] placeholder:text-[#c1c1c1] focus:outline-none focus:border-[#008060] resize-none"
                />
              </div>

              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={e => setAgreed(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-[#c1c1c1] accent-[#008060]"
                />
                <span className="text-xs text-[#6a6a6a] leading-relaxed">
                  개인정보 수집 및 이용에 동의합니다. (이름, 연락처는 업체 등록 안내 목적으로만 사용되며, 안내 완료 후 파기됩니다.)
                </span>
              </label>

              <button
                type="submit"
                disabled={!canSubmit}
                className="w-full h-11 rounded-lg bg-[#008060] text-white text-sm font-medium hover:bg-[#006b4f] transition-colors disabled:bg-[#c1c1c1] disabled:cursor-not-allowed"
              >
                문의하기
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
