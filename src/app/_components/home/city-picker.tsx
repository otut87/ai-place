'use client'

// City Picker — 헤더 로고 옆 (T-246).
//
// 첫 방문 시 미들웨어가 IP → 'aiplace-city' 쿠키를 자동 설정. 이후 사용자가
// 헤더 chip 으로 변경. 변경 시 쿠키 갱신 + router.refresh() 로 SSR 재실행하여
// 도시 컨텍스트가 반영된 페이지 재렌더.

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import { setCityCookieClient, readCityCookieClient, CITY_ALL } from '@/lib/geo/city-cookie'

// 시드 cities 와 동기화 — 도시 추가 시 src/lib/data.ts cities 와 같이 갱신.
const CITIES: Array<{ slug: string; name: string }> = [
  { slug: 'cheonan', name: '천안' },
  { slug: 'asan', name: '아산' },
]

const SUPPORT_EMAIL = 'support@aiplace.kr'

// useSyncExternalStore 용 — 쿠키 변경을 외부에서 통지받지 않으므로 subscribe 는 no-op.
// CityPicker 내부에서 쿠키를 set 한 직후엔 setLocalOverride 로 즉시 반영.
const cookieStore = {
  subscribe(): () => void {
    return () => {}
  },
  getSnapshot(): string {
    return readCityCookieClient() ?? CITY_ALL
  },
  getServerSnapshot(): string {
    return CITY_ALL
  },
}

export function CityPicker() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  // 1) 쿠키 (외부 store) 와 2) 로컬 즉시 반영 — 둘 중 로컬이 있으면 우선.
  const cookieValue = useSyncExternalStore(
    cookieStore.subscribe,
    cookieStore.getSnapshot,
    cookieStore.getServerSnapshot,
  )
  const [localOverride, setLocalOverride] = useState<string | null>(null)
  const current = localOverride ?? cookieValue
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function select(value: string) {
    setCityCookieClient(value)
    setLocalOverride(value)
    setOpen(false)
    router.refresh()
  }

  const currentName = current === CITY_ALL
    ? '전국'
    : CITIES.find(c => c.slug === current)?.name ?? '전국'

  return (
    <div ref={ref} className="city-picker">
      <button
        type="button"
        className="city-chip"
        onClick={() => setOpen(v => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`현재 지역 ${currentName}, 클릭해 변경`}
      >
        <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M12 22s-8-7.58-8-13a8 8 0 1116 0c0 5.42-8 13-8 13z" />
          <circle cx="12" cy="9" r="3" />
        </svg>
        <span className="nm">{currentName}</span>
        <svg className="caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="city-menu" role="menu">
          <button
            type="button"
            role="menuitemradio"
            aria-checked={current === CITY_ALL}
            className={current === CITY_ALL ? 'item active' : 'item'}
            onClick={() => select(CITY_ALL)}
          >
            <span className="nm">전국 보기</span>
            <span className="meta">모든 도시 통합</span>
          </button>
          <div className="sep" />
          {CITIES.map(c => (
            <button
              key={c.slug}
              type="button"
              role="menuitemradio"
              aria-checked={current === c.slug}
              className={current === c.slug ? 'item active' : 'item'}
              onClick={() => select(c.slug)}
            >
              <span className="nm">{c.name}</span>
              {current === c.slug && <span className="check">✓</span>}
            </button>
          ))}
          <div className="sep" />
          <a
            className="item req"
            href={`mailto:${SUPPORT_EMAIL}?subject=내 도시 추가 요청&body=AI Place 에 추가하고 싶은 도시: %0A`}
          >
            <span className="nm">+ 내 도시 요청</span>
            <span className="meta">{SUPPORT_EMAIL}</span>
          </a>
        </div>
      )}
    </div>
  )
}
