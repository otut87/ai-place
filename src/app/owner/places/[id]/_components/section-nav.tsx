'use client'

// T-216 — 편집 페이지 좌측 섹션 네비게이션. IntersectionObserver 기반 스크롤 스파이.
// 각 섹션 id 와 label/count 는 props 로 받는다. count 는 "completion indicator" — 채워진 필드 수.
// T-218: AI 자동 채우기 버튼 추가 (quota 표시 + 클릭 콜백).

import { useEffect, useRef, useState } from 'react'

export interface SectionNavItem {
  id: string
  label: string
  count?: string
  done?: boolean
}

interface Props {
  items: SectionNavItem[]
  publicHref?: string
  citationsHref?: string
  ai?: {
    onFill: () => void
    loading: boolean
    quotaLeft: number | null       // null = 로딩 중
    quotaLimit: number
    disabledReason?: string         // "주간 대기 중" 등
  }
}

export function SectionNav({ items, publicHref, citationsHref, ai }: Props) {
  const [activeId, setActiveId] = useState<string>(items[0]?.id ?? '')
  const ioRef = useRef<IntersectionObserver | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') return
    const sections = items
      .map((it) => document.getElementById(it.id))
      .filter((el): el is HTMLElement => el !== null)
    if (sections.length === 0) return

    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)
        if (visible[0]) setActiveId(visible[0].target.id)
      },
      { rootMargin: '-100px 0px -60% 0px', threshold: [0, 0.25, 0.5, 0.75, 1] },
    )
    ioRef.current = io
    sections.forEach((s) => io.observe(s))
    return () => io.disconnect()
  }, [items])

  function handleClick(e: React.MouseEvent<HTMLAnchorElement>, id: string) {
    e.preventDefault()
    const el = document.getElementById(id)
    if (!el) return
    const y = el.getBoundingClientRect().top + window.scrollY - 80
    window.scrollTo({ top: y, behavior: 'smooth' })
    setActiveId(id)
  }

  return (
    <aside className="pe-sec-nav">
      <h6>편집 항목</h6>
      {items.map((it) => (
        <a
          key={it.id}
          href={`#${it.id}`}
          onClick={(e) => handleClick(e, it.id)}
          className={`${it.id === activeId ? 'on' : ''}${it.done ? ' done' : ''}`}
        >
          <span className="dot"></span>
          {it.label}
          {it.count !== undefined && <span className="n">{it.count}</span>}
        </a>
      ))}

      {(publicHref || citationsHref || ai) && (
        <>
          <div className="pe-sec-nav-sep" role="separator"></div>

          {ai && (
            <button
              type="button"
              className="sn-ai-fill"
              onClick={ai.onFill}
              disabled={ai.loading || ai.quotaLeft === 0 || Boolean(ai.disabledReason)}
              title={
                ai.disabledReason
                  ?? (ai.quotaLeft === 0
                    ? '이번 30일 한도 소진 · 다음 결제일 초기화'
                    : ai.quotaLeft === null
                      ? '사용 가능 회수 확인 중…'
                      : `AI 가 빈 칸을 한번에 채워드립니다 · ${ai.quotaLeft}회 남음`)
              }
            >
              <span className="spark">
                {ai.loading ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true" className="spin">
                    <circle cx="12" cy="12" r="9" strokeDasharray="40 20" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M12 2l2.4 5.6L20 10l-5.6 2.4L12 18l-2.4-5.6L4 10l5.6-2.4z" />
                  </svg>
                )}
              </span>
              <span className="lab">{ai.loading ? 'AI 가 작성 중…' : 'AI 로 자동 채우기'}</span>
              {ai.quotaLeft !== null && (
                <span className={`quota${ai.quotaLeft === 0 ? ' out' : ai.quotaLeft <= 1 ? ' low' : ''}`}>
                  {ai.quotaLeft} / {ai.quotaLimit}
                </span>
              )}
            </button>
          )}

          {publicHref && (
            <a className="sn-link" href={publicHref} target="_blank" rel="noopener noreferrer">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              공개 페이지
            </a>
          )}
          {citationsHref && (
            <a className="sn-link" href={citationsHref}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              인용 기록
            </a>
          )}
        </>
      )}
    </aside>
  )
}
