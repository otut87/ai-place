'use client'

// Daum Postcode 주소 검색 모달 (T-017)
// 외부 스크립트 동적 로드. 수동 fallback 등록 시 사용.
// https://postcode.map.daum.net/guide

import { useCallback, useEffect, useRef, useState } from 'react'

interface DaumPostcodeData {
  roadAddress: string
  jibunAddress: string
  sigunguCode: string
  zonecode: string
  buildingName: string
  apartment: string
}

export interface AddressResult {
  roadAddress: string
  jibunAddress: string
  sigunguCode: string
  zonecode: string
  buildingName?: string
}

// Daum postcode API 전역 선언 (script loaded)
declare global {
  interface Window {
    daum?: {
      Postcode: new (opts: {
        oncomplete: (data: DaumPostcodeData) => void
        onclose?: () => void
        width?: string | number
        height?: string | number
      }) => { embed: (el: HTMLElement) => void; open: () => void }
    }
  }
}

const SCRIPT_URL = '//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js'

function loadDaumScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return reject(new Error('SSR 환경'))
    if (window.daum?.Postcode) return resolve()
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_URL}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('Daum 스크립트 로드 실패')), { once: true })
      return
    }
    const script = document.createElement('script')
    script.src = SCRIPT_URL
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Daum 스크립트 로드 실패'))
    document.head.appendChild(script)
  })
}

interface Props {
  onSelect: (result: AddressResult) => void
  triggerLabel?: string
  className?: string
}

export function AddressPicker({ onSelect, triggerLabel = '주소 검색', className }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const embedRef = useRef<HTMLDivElement | null>(null)

  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setError(null)
    loadDaumScript()
      .then(() => {
        if (cancelled || !embedRef.current || !window.daum?.Postcode) return
        embedRef.current.innerHTML = ''
        new window.daum.Postcode({
          oncomplete: data => {
            onSelect({
              roadAddress: data.roadAddress,
              jibunAddress: data.jibunAddress,
              sigunguCode: data.sigunguCode,
              zonecode: data.zonecode,
              buildingName: data.buildingName || undefined,
            })
            setOpen(false)
          },
          onclose: close,
          width: '100%',
          height: '480px',
        }).embed(embedRef.current)
        setLoading(false)
      })
      .catch(err => {
        if (!cancelled) {
          setError(err.message ?? '스크립트 로드 실패')
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [open, onSelect, close])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={className ?? 'inline-flex h-9 px-4 items-center rounded border border-[#c1c1c1] text-sm hover:bg-[#f2f2f2]'}
      >
        {triggerLabel}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={close}
          role="presentation"
        >
          <div
            className="relative bg-white rounded-lg shadow-xl w-full max-w-[480px] p-4"
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="주소 검색"
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold">주소 검색</h2>
              <button
                type="button"
                onClick={close}
                className="text-[#666] hover:text-[#1a1a1a] text-sm"
              >
                닫기 ✕
              </button>
            </div>
            {loading && <p className="text-sm text-[#666] py-6 text-center">스크립트 로딩 중…</p>}
            {error && <p className="text-sm text-red-600 py-6 text-center">{error}</p>}
            <div ref={embedRef} style={{ minHeight: error ? 0 : 480 }} />
          </div>
        </div>
      )}
    </>
  )
}
