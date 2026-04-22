// /owner/* 공통 빈 상태. "기능 라우트로 들어왔는데 업체/데이터가 아직 없음" 공용.
// .owner-empty-state 스타일 재사용.

import Link from 'next/link'
import type { ReactNode } from 'react'

interface ActionLink {
  href: string
  label: string
  variant?: 'accent' | 'ghost'
}

interface Props {
  /** "· · · 아직 아무것도 없어요 · · ·" 같은 eyebrow 라벨. */
  eyebrow?: string
  /** 제목. 강조어는 <em> 또는 <span className="it">로. */
  title: ReactNode
  /** 설명 본문. */
  description?: ReactNode
  /** 주 CTA. */
  action?: ActionLink
  /** 추가 보조 CTA. */
  secondaryAction?: ActionLink
}

export function EmptyState({ eyebrow, title, description, action, secondaryAction }: Props) {
  return (
    <div className="owner-empty-state">
      {eyebrow && <span className="i">{eyebrow}</span>}
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {(action || secondaryAction) && (
        <div className="owner-empty-state-actions">
          {action && (
            <Link className={`btn ${action.variant ?? 'accent'} lg`} href={action.href}>
              {action.label}
            </Link>
          )}
          {secondaryAction && (
            <Link className={`btn ${secondaryAction.variant ?? 'ghost'} lg`} href={secondaryAction.href}>
              {secondaryAction.label}
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
