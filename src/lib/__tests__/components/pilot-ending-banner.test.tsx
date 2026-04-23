// T-226 — PilotEndingBanner 테스트.
// D-3/D-1/D-0 범위에서만 렌더, 그 외엔 null.
// 금액 포맷 + 날짜 표기 + CTA 링크 검증.

import { describe, it, expect, vi } from 'vitest'
import type { ReactNode } from 'react'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next/link', () => ({
  default: (props: Record<string, unknown>) => {
    const { href, children, ...rest } = props
    return createElement('a', { href: href as string, ...rest }, children as ReactNode)
  },
}))

async function render(props: Parameters<typeof import('@/app/owner/_components/pilot-ending-banner').PilotEndingBanner>[0]): Promise<string> {
  const { PilotEndingBanner } = await import('@/app/owner/_components/pilot-ending-banner')
  return renderToStaticMarkup(createElement(PilotEndingBanner, props))
}

describe('PilotEndingBanner', () => {
  it('D-4 이상 → 렌더 안 함 (null)', async () => {
    const html = await render({
      pilotRemainingDays: 4,
      trialEndsAt: '2026-05-01T00:00:00Z',
      activePlaceCount: 1,
    })
    expect(html).toBe('')
  })

  it('D-7 → 렌더 안 함', async () => {
    const html = await render({
      pilotRemainingDays: 7,
      trialEndsAt: '2026-05-04T00:00:00Z',
      activePlaceCount: 1,
    })
    expect(html).toBe('')
  })

  it('이미 종료 (pilotRemainingDays < 0) → 렌더 안 함', async () => {
    const html = await render({
      pilotRemainingDays: -2,
      trialEndsAt: '2026-04-20T00:00:00Z',
      activePlaceCount: 1,
    })
    expect(html).toBe('')
  })

  it('D-3 → 렌더 + 금액(14,900) + 날짜 + 해지 링크', async () => {
    const html = await render({
      pilotRemainingDays: 3,
      trialEndsAt: '2026-05-04T00:00:00Z',
      activePlaceCount: 1,
    })
    expect(html).toContain('D-3')
    expect(html).toContain('14,900')
    expect(html).toContain('2026-05-04')
    expect(html).toContain('업체 1개')
    expect(html).toContain('/owner/billing/cancel')
    expect(html).toContain('자세히')
  })

  it('D-1 + 업체 3개 → 금액 44,700 표기', async () => {
    const html = await render({
      pilotRemainingDays: 1,
      trialEndsAt: '2026-05-02T00:00:00Z',
      activePlaceCount: 3,
    })
    expect(html).toContain('D-1')
    expect(html).toContain('44,700')
    expect(html).toContain('업체 3개')
  })

  it('D-0 (당일) → "오늘" 문구 + accent 클래스', async () => {
    const html = await render({
      pilotRemainingDays: 0,
      trialEndsAt: '2026-05-01T00:00:00Z',
      activePlaceCount: 2,
    })
    expect(html).toContain('오늘')
    expect(html).toContain('29,800')
    expect(html).toContain('accent')
  })

  it('hideDetailCta=true → "자세히" 링크 제거 (빌링 페이지 내부 사용)', async () => {
    const html = await render({
      pilotRemainingDays: 2,
      trialEndsAt: '2026-05-03T00:00:00Z',
      activePlaceCount: 1,
      hideDetailCta: true,
    })
    expect(html).not.toContain('자세히')
    // 해지는 남아야 함
    expect(html).toContain('/owner/billing/cancel')
  })

  it('trialEndsAt null 이어도 안전하게 렌더 (날짜 skip)', async () => {
    const html = await render({
      pilotRemainingDays: 3,
      trialEndsAt: null,
      activePlaceCount: 1,
    })
    expect(html).toContain('D-3')
    expect(html).toContain('14,900')
  })

  it('activePlaceCount=0 → 금액 0, breakdown 미노출', async () => {
    const html = await render({
      pilotRemainingDays: 3,
      trialEndsAt: '2026-05-04T00:00:00Z',
      activePlaceCount: 0,
    })
    expect(html).toContain('D-3')
    expect(html).toContain('₩0')
    expect(html).not.toContain('업체 0개')   // breakdown 은 활성 업체가 있을 때만
  })
})
