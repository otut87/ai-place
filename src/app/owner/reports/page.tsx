// /owner/reports — 월간 리포트 다운로드/미리보기 허브.
//
// 데이터 소스: buildMonthlyReportData (on-demand, DB 저장 안 함).
// 각 업체 × 이번 달 / 전월 / 전전월 리포트를 선택해 뷰어로 이동.

import type { Metadata } from 'next'
import Link from 'next/link'
import { requireOwnerUser } from '@/lib/owner/auth'
import { listOwnerPlaces } from '@/lib/actions/owner-places'
import { composePageTitle } from '@/lib/seo/compose-title'
import { PageHeader } from '../_components/page-header'
import { EmptyState } from '../_components/empty-state'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: composePageTitle('월간 리포트'),
  description: '업체별 AI 가독성·봇 방문·인용율 월간 리포트를 확인·저장하세요.',
  robots: { index: false, follow: false },
}

function periodOptions(now: Date = new Date()): Array<{ key: string; label: string; isCurrent: boolean }> {
  const out: Array<{ key: string; label: string; isCurrent: boolean }> = []
  for (let i = 0; i < 3; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = `${d.getFullYear()}년 ${d.getMonth() + 1}월`
    out.push({ key, label, isCurrent: i === 0 })
  }
  return out
}

export default async function OwnerReportsPage() {
  await requireOwnerUser()
  const ownerPlaces = await listOwnerPlaces()
  const periods = periodOptions()

  if (ownerPlaces.length === 0) {
    return (
      <section className="wrap">
        <PageHeader
          title={<>월간 <em>리포트</em></>}
          subtitle="업체를 등록하면 매월 1일 자동으로 리포트가 생성됩니다."
        />
        <EmptyState
          eyebrow="· · · 아직 등록된 업체가 없어요 · · ·"
          title={<>업체를 <em>등록</em>하고 첫 리포트를 받으세요</>}
          description="파일럿 30일 동안은 실시간 대시보드로도 충분합니다. 월간 리포트는 첫 달 말일에 이메일로 도착합니다."
          action={{ href: '/owner/places/new', label: '+ 업체 등록' }}
        />
      </section>
    )
  }

  return (
    <section className="wrap">
      <PageHeader
        title={<>월간 <em>리포트</em></>}
        subtitle="AI 가독성 · 봇 방문 · 인용율 · 개선 우선순위를 한 장으로 정리합니다."
        back={{ href: '/owner', label: '대시보드' }}
      />

      <section style={{ marginTop: 16 }}>
        {ownerPlaces.filter((p) => p.status === 'active').length === 0 && (
          <div className="owner-banner warn" role="alert" style={{ marginBottom: 12 }}>
            <span>공개(active) 상태 업체가 없습니다. 리포트는 공개 페이지 기준으로 생성됩니다.</span>
          </div>
        )}

        {ownerPlaces.map((p) => (
          <article key={p.id} className="dash-panel" style={{ marginBottom: 12 }}>
            <div className="head">
              <h3>{p.name}</h3>
              <span className="chip muted">/{p.city}/{p.category}/{p.slug}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {periods.map((period) => (
                <div key={period.key} className="report-card" style={{ margin: 0 }}>
                  <div className="icon" aria-hidden="true">📊</div>
                  <div className="body">
                    <h4>{period.label} 리포트</h4>
                    <div className="meta">
                      {period.isCurrent ? '진행 중 · 실시간 집계' : '완료된 기간 · 확정 수치'} · AI 가독성 + 봇 방문 + 개선 제안
                    </div>
                  </div>
                  <div className="cta">
                    <Link
                      className="btn accent sm"
                      href={`/owner/reports/${p.id}?period=${period.key}`}
                    >
                      열기 →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </article>
        ))}
      </section>

      <p className="info-note" style={{ marginTop: 16 }}>
        ⓘ 매월 1일 오전 9시 KST 에 공개(active) 업체 대상 자동 이메일 발송됩니다. PDF 는 리포트 뷰어의 인쇄 버튼(Ctrl+P → PDF 로 저장)으로 내려받을 수 있습니다.
      </p>
    </section>
  )
}
