// /login · /signup · /account/* 공용 2단 셸.
// 좌측 AuthPromo 고정 + 우측 폼 영역. backHref 주면 상단에 뒤로가기 링크 노출.
import Link from 'next/link'
import { AuthPromo } from './auth-promo'

interface Props {
  children: React.ReactNode
  backHref?: string
  backLabel?: string
}

export function AuthShell({ children, backHref, backLabel = '뒤로' }: Props) {
  return (
    <div className="auth-root">
      <div className="split">
        <AuthPromo />
        <section className="form-side">
          <div className="form-wrap">
            {backHref && (
              <Link href={backHref} className="auth-back">
                ← {backLabel}
              </Link>
            )}
            {children}
          </div>
        </section>
      </div>
    </div>
  )
}
