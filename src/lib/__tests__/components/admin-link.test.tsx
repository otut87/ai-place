/**
 * T-058 AdminLink — next/link 를 prefetch={false} 기본값으로 래핑.
 */
import { describe, it, expect, vi } from 'vitest'
import type { ReactNode } from 'react'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// next/link 는 SSR 렌더 시 <a> 로 변환되지만 prefetch 속성은 runtime 에서만 쓰임.
// mock 으로 전달된 prefetch prop 을 직접 확인한다.
const linkCalls: Array<Record<string, unknown>> = []

vi.mock('next/link', () => ({
  default: (props: Record<string, unknown>) => {
    linkCalls.push(props)
    const { href, children, prefetch: _prefetch, ...rest } = props
    return createElement('a', { href: href as string, ...rest }, children as ReactNode)
  },
}))

// 테스트에서는 children 을 3번째 인자로 넘기기 위해 느슨한 타입으로 AdminLink 를 감싼다.
const renderAdminLink = async (props: Record<string, unknown>, children: string) => {
  const { AdminLink } = await import('@/components/admin/admin-link')
  const Component = AdminLink as unknown as (p: Record<string, unknown>) => unknown
  return renderToStaticMarkup(createElement(Component as never, props, children))
}

describe('AdminLink', () => {
  it('prefetch 명시 안 하면 false 로 next/link 호출', async () => {
    linkCalls.length = 0
    await renderAdminLink({ href: '/admin/places' }, '목록')
    expect(linkCalls[0].prefetch).toBe(false)
  })

  it('prefetch={true} 로 덮어쓰면 그대로 전달', async () => {
    linkCalls.length = 0
    await renderAdminLink({ href: '/x', prefetch: true }, 'x')
    expect(linkCalls[0].prefetch).toBe(true)
  })

  it('href / className 등 다른 props 는 투명 전달', async () => {
    linkCalls.length = 0
    await renderAdminLink({ href: '/a', className: 'foo' }, 'y')
    expect(linkCalls[0].href).toBe('/a')
    expect(linkCalls[0].className).toBe('foo')
  })
})
