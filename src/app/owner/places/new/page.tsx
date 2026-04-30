// T-201/T-220/T-223.5/T-259 R6 — 업체 등록 페이지.
// 좌: step flow + form / 우: sticky summary-card.
// T-259 R6: register-first 전환. 카드 없어도 업체 등록은 허용.
//   대신 발행/AI 리포트는 카드 있어야 활성화 (대시보드 안내 + 백엔드 가드 별도).

import { requireOwnerUser } from '@/lib/owner/auth'
import { getCities, getCategories } from '@/lib/data.supabase'
import { OwnerRegisterForm } from './owner-register-form'
import { MONTHLY_PRICE_LABEL } from '@/lib/pricing'

export const dynamic = 'force-dynamic'

export default async function NewPlacePage() {
  await requireOwnerUser()

  const [cities, categories] = await Promise.all([getCities(), getCategories()])

  return (
    <div className="pl-new">
      <div>
        <header className="pl-head">
          <span className="kicker">평균 3분 소요 · 네이버·Google 자동 채움</span>
          <h1>
            업체명만 입력하면,<br />
            기본 정보는 <span className="it">자동으로 들어옵니다</span>.
          </h1>
          <p>
            네이버 플레이스에서 업체를 찾고, Google 에서 평점·리뷰·영업시간을 끌어와
            AI 최적화 프로필을 자동으로 만듭니다. 소개·서비스·FAQ·태그는 AI 초안이 제안됩니다.
          </p>
        </header>

        <OwnerRegisterForm
          cities={cities.map((c) => ({ slug: c.slug, name: c.name }))}
          categories={categories.map((c) => ({ slug: c.slug, name: c.name, sector: c.sector }))}
        />
      </div>

      <aside>
        <div className="summary-card">
          <h3>등록 시 자동으로 생기는 것</h3>
          <p className="why">
            사장님이 채워주시는 건 업체명·업종·지역 세 개뿐. 나머지는 AI 가
            네이버·Google 데이터를 읽어 자동으로 구성합니다.
          </p>
          <div className="incl">
            <div>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} aria-hidden="true">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>aiplace.kr 전용 페이지 1장 (SEO · AEO · GEO 최적화)</span>
            </div>
            <div>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} aria-hidden="true">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>LocalBusiness JSON-LD 자동 생성 (AI 인용률 ↑)</span>
            </div>
            <div>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} aria-hidden="true">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>리뷰·영업시간·대표 사진 Google 자동 수집</span>
            </div>
            <div>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} aria-hidden="true">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>소개·서비스·FAQ·태그 AI 초안 자동 생성</span>
            </div>
            <div>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} aria-hidden="true">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>오너 대시보드에서 AI 인용·방문 실측 모니터링</span>
            </div>
          </div>
          <div className="foot">
            ※ 등록 후 30일 파일럿 무료 · 이후 업체당 {MONTHLY_PRICE_LABEL} 자동 결제.
          </div>
        </div>
      </aside>
    </div>
  )
}
