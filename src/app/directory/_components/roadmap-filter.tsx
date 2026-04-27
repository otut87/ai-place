'use client'

// 확장 로드맵 (heatmap 변형) 필터 — 전체 / 라이브 / 모집중.
// 자식 셀은 data-state 속성으로 'live' | 'recruiting' | 'empty' 중 하나.

import { useState, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

export function RoadmapFilter({ children }: Props) {
  const [filter, setFilter] = useState<'all' | 'live' | 'recruiting'>('all')

  return (
    <>
      <div className="filter" role="group" aria-label="필터">
        <button
          type="button"
          className={filter === 'all' ? 'on' : ''}
          onClick={() => setFilter('all')}
        >
          전체
        </button>
        <button
          type="button"
          className={filter === 'live' ? 'on' : ''}
          onClick={() => setFilter('live')}
        >
          파일럿 라이브
        </button>
        <button
          type="button"
          className={filter === 'recruiting' ? 'on' : ''}
          onClick={() => setFilter('recruiting')}
        >
          모집중
        </button>
      </div>
      <div className="matrix-scroll" data-filter={filter}>
        {children}
      </div>
      <style>{`
        .matrix-scroll[data-filter="live"] .cell:not([data-state="live"]) { opacity: .22; }
        .matrix-scroll[data-filter="recruiting"] .cell:not([data-state="recruiting"]) { opacity: .22; }
      `}</style>
    </>
  )
}
