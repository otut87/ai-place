'use client'

// 디렉토리 우측 패널 — 최근 발행 블로그 글 피드의 탭 필터.
// 디자인 시안의 .hd 안에 live-dot 과 tabs 가 같이 들어가는 레이아웃을 그대로 유지.
// 자식으로 받은 row 들은 data-sector 속성을 가지고 있어야 함.

import { useId, useState, type ReactNode } from 'react'

interface Tab {
  key: string
  label: string
}

interface Props {
  liveLabel: string
  tabs: Tab[]
  children: ReactNode
}

export function FeedTabs({ liveLabel, tabs, children }: Props) {
  const [active, setActive] = useState<string>(tabs[0]?.key ?? 'all')
  const scopeId = useId().replace(/[:]/g, '')

  // CSS-only 표시 토글: data-active 와 data-sector 매칭으로 .feed-row 표시.
  const styleRules = tabs
    .filter(t => t.key !== 'all')
    .map(
      t => `
        .${scopeId}[data-active="${t.key}"] .feed-row { display: none; }
        .${scopeId}[data-active="${t.key}"] .feed-row[data-sector="${t.key}"] { display: grid; }
      `,
    )
    .join('')

  return (
    <>
      <div className="hd">
        <div className="live-dot">{liveLabel}</div>
        <div className="feed-tabs" role="tablist">
          {tabs.map(t => (
            <button
              key={t.key}
              type="button"
              role="tab"
              className={active === t.key ? 'active' : ''}
              onClick={() => setActive(t.key)}
              aria-selected={active === t.key}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className={`feed ${scopeId}`} data-active={active}>
        {children}
      </div>
      <style>{`
        .${scopeId}[data-active="all"] .feed-row { display: grid; }
        ${styleRules}
      `}</style>
    </>
  )
}
