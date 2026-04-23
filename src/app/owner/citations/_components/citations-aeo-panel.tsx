// T-209 — /owner/citations 의 AEO 패널.
// 기존 /owner/reports 의 "AI 가독성 점수 + top 3 이슈" 데이터를 흡수.
// 업체별 카드 나열 — 클릭 시 /owner/places/[id]/dashboard 로 이동.

import Link from 'next/link'
import type { AeoSnapshot } from '@/lib/owner/aeo-snapshot'

interface Props {
  snapshots: AeoSnapshot[]
  placeNameById: Map<string, string>
}

function gradeColor(grade: AeoSnapshot['grade']): string {
  switch (grade) {
    case 'A': return 'var(--good, #10a37f)'
    case 'B': return 'var(--accent, #c09062)'
    case 'C': return 'var(--warn, #b45309)'
    case 'D': return 'var(--bad, #b91c1c)'
  }
}

export function CitationsAeoPanel({ snapshots, placeNameById }: Props) {
  void placeNameById

  if (snapshots.length === 0) {
    return (
      <div className="aeo-panel-empty">
        <p>AEO 점수를 계산할 업체 데이터가 아직 없습니다.</p>
      </div>
    )
  }

  return (
    <div className="aeo-panel">
      {snapshots.map((s) => {
        const dashboardHref = `/owner/places/${s.placeId}/dashboard`
        const publicHref = `/${s.citySlug}/${s.categorySlug}/${s.placeSlug}`
        return (
          <article key={s.placeId} className="aeo-card">
            <header>
              <div className="title">
                <h3>{s.placeName}</h3>
                <a className="public-link" href={publicHref} target="_blank" rel="noreferrer">
                  공개 페이지 ↗
                </a>
              </div>
              <div className="score-pill" style={{ '--grade-color': gradeColor(s.grade) } as React.CSSProperties}>
                <span className="grade">{s.grade}</span>
                <span className="score">{s.score}<small>/100</small></span>
                <span className="pass-count">{s.passedCount}/{s.totalCount} 룰 통과</span>
              </div>
            </header>

            {s.topIssues.length === 0 ? (
              <p className="all-pass">🎉 모든 AEO 항목을 통과했습니다.</p>
            ) : (
              <div className="issues">
                <div className="issues-head">개선 우선순위</div>
                <ul>
                  {s.topIssues.map((iss, idx) => (
                    <li key={`${s.placeId}-${idx}`}>
                      <b>{iss.label}</b>
                      {iss.detail && <span className="detail"> · {iss.detail}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <footer>
              <Link className="btn ghost sm" href={dashboardHref}>
                업체 대시보드 →
              </Link>
            </footer>
          </article>
        )
      })}

      <style>{`
        .aeo-panel {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: 12px;
        }
        .aeo-panel-empty {
          padding: 20px;
          background: var(--card, #fff);
          border: 1px solid var(--line-2, #e7e5e1);
          border-radius: var(--r-lg, 14px);
          color: var(--ink-soft, #6b6b6b);
        }
        .aeo-card {
          background: var(--card, #fff);
          border: 1px solid var(--line-2, #e7e5e1);
          border-radius: var(--r-lg, 14px);
          padding: 18px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .aeo-card header {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .aeo-card .title {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 8px;
        }
        .aeo-card h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
          color: var(--ink, #191919);
        }
        .aeo-card .public-link {
          font-size: 12px;
          color: var(--ink-soft, #6b6b6b);
          text-decoration: none;
        }
        .aeo-card .public-link:hover { color: var(--ink, #191919); }
        .aeo-card .score-pill {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          background: color-mix(in oklab, var(--grade-color) 8%, transparent);
          border-left: 3px solid var(--grade-color);
          border-radius: 8px;
        }
        .aeo-card .grade {
          font-size: 22px;
          font-weight: 700;
          color: var(--grade-color);
          font-family: var(--font-serif, Georgia, serif);
        }
        .aeo-card .score {
          font-size: 18px;
          font-weight: 600;
          color: var(--ink, #191919);
        }
        .aeo-card .score small {
          font-size: 12px;
          color: var(--ink-soft, #9a9a9a);
          font-weight: 400;
        }
        .aeo-card .pass-count {
          margin-left: auto;
          font-size: 12px;
          color: var(--ink-soft, #6b6b6b);
        }
        .aeo-card .all-pass {
          margin: 0;
          padding: 12px;
          background: color-mix(in oklab, var(--good, #10a37f) 6%, transparent);
          border-radius: 8px;
          font-size: 13px;
          color: var(--ink, #191919);
        }
        .aeo-card .issues-head {
          font-size: 12px;
          font-weight: 600;
          color: var(--ink-soft, #6b6b6b);
          text-transform: uppercase;
          letter-spacing: 0.04em;
          margin-bottom: 6px;
        }
        .aeo-card .issues ul {
          margin: 0;
          padding: 0;
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .aeo-card .issues li {
          padding: 8px 10px;
          background: color-mix(in oklab, var(--warn, #b45309) 6%, transparent);
          border-radius: 6px;
          font-size: 13px;
          color: var(--ink, #191919);
        }
        .aeo-card .issues li .detail {
          color: var(--ink-soft, #6b6b6b);
          font-size: 12px;
        }
        .aeo-card footer {
          display: flex;
          justify-content: flex-end;
        }
      `}</style>
    </div>
  )
}
