// /owner/* 공통 페이지 헤더. .greeting 스타일 재사용 + back/actions 슬롯 표준화.
//
// 사용 예:
//   <PageHeader
//     title={<>AI <em>인용</em> 현황</>}
//     subtitle="전체 5곳 · 최근 90일"
//     back={{ href: '/owner', label: '대시보드' }}
//   />

import Link from 'next/link'
import type { ReactNode } from 'react'

interface BackLink {
  href: string
  label: string
}

interface Props {
  /** 본문 제목. 강조어는 <em> 또는 <span className="it">로 감싸서 italic 렌더. */
  title: ReactNode
  /** 제목 아래 한 줄 설명. */
  subtitle?: ReactNode
  /** 좌측 상단 뒤로가기 링크. 없으면 미노출. */
  back?: BackLink
  /** 우측 상단 액션 버튼 영역 (Link/Button 등). */
  actions?: ReactNode
}

export function PageHeader({ title, subtitle, back, actions }: Props) {
  return (
    <header className="page-header">
      {back && (
        <Link href={back.href} className="page-header-back">
          ← {back.label}
        </Link>
      )}
      <div className="page-header-row">
        <div className="page-header-body">
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {actions && <div className="page-header-actions">{actions}</div>}
      </div>
    </header>
  )
}
