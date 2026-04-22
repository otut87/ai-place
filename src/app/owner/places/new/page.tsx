// T-201 — 업체 등록 페이지 (docs/AIPLACE/register.html 디자인).
// reg-layout: 좌측 폼 카드 · 우측 summary-card (플로우 안내).
// 실 기능은 기존 server action (register-place · owner-register-place) 사용.

import { requireOwnerUser } from '@/lib/owner/auth'
import { getCities, getCategories } from '@/lib/data.supabase'
import { OwnerRegisterForm } from './owner-register-form'

export const dynamic = 'force-dynamic'

export default async function NewPlacePage() {
  await requireOwnerUser()
  const [cities, categories] = await Promise.all([getCities(), getCategories()])

  return (
    <div className="wrap reg-layout" style={{ padding: 'clamp(24px, 4vw, 40px) 0 80px' }}>
      <div>
        <div className="reg-head">
          <span className="chip accent">● 평균 3분 소요 · 네이버·Google 자동 채움</span>
          <h1>
            업체명만 입력하면,<br />
            <span className="it">기본 정보는</span> 자동으로 들어옵니다.
          </h1>
          <p>
            네이버 플레이스에서 업체를 찾고, Google 에서 평점·리뷰·영업시간을 끌어와
            AI 최적화 프로필을 자동으로 만듭니다. 사진·FAQ 는 AI 가 초안을 제안합니다.
          </p>
        </div>

        <OwnerRegisterForm
          cities={cities.map((c) => ({ slug: c.slug, name: c.name }))}
          categories={categories.map((c) => ({ slug: c.slug, name: c.name, sector: c.sector }))}
        />
      </div>

      <aside>
        <div className="summary-card">
          <h3>등록하면 자동으로 생기는 것</h3>
          <p className="why">
            사장님이 채워주시는 건 업체명·업종·지역 세 개뿐.
            나머지는 AI 가 네이버·Google 데이터를 읽어 자동으로 구성합니다.
          </p>
          <div className="incl">
            <div>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>aiplace.kr 전용 페이지 1장 (SEO · AEO · GEO 최적화)</span>
            </div>
            <div>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>LocalBusiness JSON-LD 자동 생성 (AI 인용률 ↑)</span>
            </div>
            <div>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>리뷰·영업시간·대표 사진 Google 자동 수집</span>
            </div>
            <div>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>소개·서비스·FAQ·태그 AI 초안 자동 생성</span>
            </div>
            <div>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>오너 대시보드에서 AI 인용·방문 실측 모니터링</span>
            </div>
          </div>
          <div className="foot">
            ※ 등록 후 30일 파일럿 무료 · 이후 월 9,900원 자동 결제는 카드 등록한 경우에만 진행됩니다.
          </div>
        </div>
      </aside>
    </div>
  )
}
