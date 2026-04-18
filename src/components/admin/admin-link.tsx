// T-058 — admin/owner 영역 내부 내비게이션 링크.
// next/link 의 기본 RSC prefetch 가 /admin/* 에서는 비용(메인 스레드 점유 + _rsc 폭주)을
// 정당화하지 못하므로 prefetch={false} 를 기본값으로 강제한다.
// 사용자가 의도적으로 prefetch={true} 를 지정하면 그대로 전달.

import Link, { type LinkProps } from 'next/link'
import type { AnchorHTMLAttributes, ReactNode } from 'react'

type AnchorProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps>

export interface AdminLinkProps extends LinkProps, AnchorProps {
  children: ReactNode
}

export function AdminLink({ prefetch, children, ...rest }: AdminLinkProps) {
  return (
    <Link prefetch={prefetch ?? false} {...rest}>
      {children}
    </Link>
  )
}
