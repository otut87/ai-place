// T-120 — 공용 OG 템플릿 테스트.
import { describe, it, expect } from 'vitest'
import { OgLayout, OG_SIZE } from '@/lib/og-template'

describe('T-120 OG template', () => {
  it('OG_SIZE 는 1200x630 고정', () => {
    expect(OG_SIZE.width).toBe(1200)
    expect(OG_SIZE.height).toBe(630)
  })

  it('OgLayout 는 React 엘리먼트를 반환 (title/subtitle/badge 포함)', () => {
    const el = OgLayout({ title: '천안 피부과 추천', subtitle: '12곳', badge: '블로그' })
    expect(el).toBeTruthy()
    expect(el.type).toBe('div')
    expect(el.props.style.width).toBe('100%')
  })

  it('subtitle·badge 없이 title 만으로도 렌더 가능', () => {
    const el = OgLayout({ title: 'AI Place' })
    expect(el).toBeTruthy()
    expect(el.type).toBe('div')
  })
})
