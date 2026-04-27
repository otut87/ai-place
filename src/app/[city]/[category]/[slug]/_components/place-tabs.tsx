'use client'

// Place detail 상단 sticky 탭 — scroll spy 로 active 토글.
// 단순 anchor 링크라 Server Component 로도 가능하지만 active 표시를 위해 client.

import { useEffect, useState } from 'react'

interface Tab {
  id: string
  label: string
}

export function PlaceTabs({ tabs }: { tabs: Tab[] }) {
  const [active, setActive] = useState<string>(tabs[0]?.id ?? '')

  useEffect(() => {
    if (tabs.length === 0) return
    const elements = tabs
      .map(t => document.getElementById(t.id))
      .filter((el): el is HTMLElement => el !== null)
    if (elements.length === 0) return

    const onScroll = () => {
      const y = window.scrollY + 140
      let current = elements[0]?.id ?? tabs[0]?.id ?? ''
      for (const el of elements) {
        if (el.offsetTop <= y) current = el.id
      }
      setActive(current)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [tabs])

  return (
    <div className="pd-tabs">
      <div className="wrap inner">
        {tabs.map(t => (
          <a key={t.id} href={`#${t.id}`} className={active === t.id ? 'active' : ''}>
            {t.label}
          </a>
        ))}
      </div>
    </div>
  )
}
