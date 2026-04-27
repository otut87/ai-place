'use client'

// Blog post 좌측 TOC — server 에서 추출한 항목 목록을 받아 scroll spy 로 active 표시.

import { useEffect, useState } from 'react'

interface TocItem {
  depth: 2 | 3
  id: string
  text: string
}

export function BlogToc({ items }: { items: TocItem[] }) {
  const [active, setActive] = useState<string>(items[0]?.id ?? '')

  useEffect(() => {
    if (items.length === 0) return
    const elements = items
      .map(t => document.getElementById(t.id))
      .filter((el): el is HTMLElement => el !== null)
    if (elements.length === 0) return

    const onScroll = () => {
      const y = window.scrollY + 140
      let current = elements[0]?.id ?? items[0]?.id ?? ''
      for (const el of elements) {
        if (el.offsetTop <= y) current = el.id
      }
      setActive(current)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [items])

  if (items.length === 0) return null

  return (
    <ul className="toc-list">
      {items.map((it, idx) => (
        <li key={it.id}>
          <a
            href={`#${it.id}`}
            className={`${active === it.id ? 'active' : ''}${it.depth === 3 ? ' depth-3' : ''}`}
          >
            <span className="n">{String(idx + 1).padStart(2, '0')}</span>
            {it.text}
          </a>
        </li>
      ))}
    </ul>
  )
}
