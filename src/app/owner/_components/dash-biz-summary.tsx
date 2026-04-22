// /owner 홈 — 업체 수 요약 카드 (공개/검토 + 콘텐츠 연결 + A/B 등급).

import Link from 'next/link'
import type { OwnerPlaceSummary } from '@/lib/owner/dashboard-data'

export function DashBizSummary({ places }: { places: OwnerPlaceSummary[] }) {
  const active = places.filter((p) => p.status === 'active').length
  const pending = places.length - active
  const linked = places.filter((p) => p.mentionCount > 0).length
  const aCount = places.filter((p) => p.aeoGrade === 'A').length
  const bCount = places.filter((p) => p.aeoGrade === 'B').length

  return (
    <div className="biz-sum">
      <div className="t">
        <h3>내 업체</h3>
        <small>전체</small>
      </div>
      <div className="num">
        {places.length}<span className="u">곳</span>
        <div className="chips">
          <span className="c on">● 공개 {active}</span>
          <span className="c">검토 {pending}</span>
        </div>
      </div>
      <div className="split">
        <div className="c">
          <div className="l">콘텐츠 연결</div>
          <div className="n">{linked}<small>/{places.length}</small></div>
        </div>
        <div className="c">
          <div className="l">A 등급</div>
          <div className="n">{aCount}<small>/{places.length}</small></div>
        </div>
        <div className="c">
          <div className="l">B 등급</div>
          <div className="n">{bCount}<small>/{places.length}</small></div>
        </div>
      </div>
      <Link className="add" href="/owner/places/new">+ 새 업체 추가</Link>
    </div>
  )
}
