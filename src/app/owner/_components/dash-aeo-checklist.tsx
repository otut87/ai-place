// /owner 홈 — AEO 개선 체크리스트 패널.
// 최저 점수 업체 기준으로 8룰 pass/fail 노출. CTA = 해당 업체 편집.

import Link from 'next/link'
import type { OwnerPlaceSummary } from '@/lib/owner/dashboard-data'

interface Props {
  places: OwnerPlaceSummary[]
}

export function DashAeoChecklist({ places }: Props) {
  // 가장 낮은 점수 업체 — 개선 효과가 큰 후보.
  const target = [...places].sort((a, b) => a.aeoScore - b.aeoScore)[0]

  if (!target) {
    return (
      <div className="dash-panel2 aeo-ck">
        <div className="phead">
          <h3>AEO 개선 체크리스트</h3>
          <div className="dash-total">기준 <b>100점</b></div>
        </div>
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
          업체 등록 후 체크리스트가 표시됩니다.
        </div>
      </div>
    )
  }

  return (
    <div className="dash-panel2 aeo-ck">
      <div className="phead">
        <h3>AEO 개선 체크리스트</h3>
        <div className="dash-total">기준 <b>100점</b></div>
      </div>
      <div className="list">
        {target.aeoRules.map((r) => (
          <div key={r.id} className={`it ${r.passed ? 'done' : 'miss'}`}>
            <span className="ic">{r.passed ? '✓' : '·'}</span>
            <span className="lbl">{r.label}{!r.passed && r.detail ? ` · ${r.detail}` : ''}</span>
            <span className="pt">+{r.weight}</span>
          </div>
        ))}
      </div>
      <div className="cta">
        <Link className="btn primary" href={`/owner/places/${target.id}`}>
          {target.name} 편집하기 →
        </Link>
      </div>
    </div>
  )
}
