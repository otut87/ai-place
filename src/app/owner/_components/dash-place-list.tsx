// /owner 홈 — 업체 리스트 (ring score + chips + actions).

import Link from 'next/link'
import type { OwnerPlaceSummary } from '@/lib/owner/dashboard-data'
import type { AeoRuleResult } from '@/lib/owner/place-aeo-score'

/** chip 전용 축약 라벨. 통과 시 detail(수치)를 함께 붙이고 실패 시 label + detail 사유. */
function chipLabel(r: AeoRuleResult): string {
  // 실패면 label 기준으로 간단히 요약.
  if (!r.passed) return r.detail ? `${r.label}` : r.label
  // 통과면 수치/요약을 괄호 없이 붙임.
  switch (r.id) {
    case 'photos-3':       return '대표 사진 3장 이상'
    case 'faq-count':      return 'FAQ 3~10개'
    case 'opening-hours':  return '영업시간 정확'
    case 'jsonld-basics':  return 'JSON-LD 완료'
    case 'review-summary': return '리뷰 수집'
    case 'services-min':   return '서비스 등록'
    case 'freshness':      return '최근 갱신'
    case 'mentioned-in-content': return '콘텐츠 언급'
    default:               return r.label
  }
}

interface Props {
  places: OwnerPlaceSummary[]
}

function gradeColor(grade: OwnerPlaceSummary['aeoGrade']): string {
  if (grade === 'A') return '#0f7d3d'
  if (grade === 'B') return '#4a4a4a'
  if (grade === 'C') return '#b45309'
  return '#ff5c2b'
}

function scoreDashArray(score: number): string {
  // r=23 → C≈144.5
  const C = 2 * Math.PI * 23
  const dash = Math.max(0, Math.min(1, score / 100)) * C
  return `${dash.toFixed(1)} ${C.toFixed(1)}`
}

export function DashPlaceList({ places }: Props) {
  return (
    <div className="dash-panel2 biz-grid">
      <div className="phead">
        <h3>등록된 업체 · {places.length}곳</h3>
        <Link href="/owner/places/new" style={{ fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--accent)', textDecoration: 'none' }}>
          + 업체 추가
        </Link>
      </div>

      {places.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
          아직 등록된 업체가 없어요.
        </div>
      ) : (
        places.map((p) => {
          const color = gradeColor(p.aeoGrade)
          return (
            <article key={p.id} className="biz">
              <div className="score-ring">
                <svg viewBox="0 0 56 56">
                  <circle cx={28} cy={28} r={23} fill="none" stroke="#efece4" strokeWidth={5} />
                  <circle
                    cx={28} cy={28} r={23} fill="none"
                    stroke={color} strokeWidth={5} strokeLinecap="round"
                    strokeDasharray={scoreDashArray(p.aeoScore)}
                  />
                </svg>
                <div className="vv">{p.aeoScore}</div>
              </div>

              <div className="body">
                <div className="top">
                  <span className="name">{p.name}</span>
                  <span className={`st ${p.status === 'active' ? 'public' : 'pending'}`}>
                    {p.status === 'active' ? '공개' : '검토'}
                  </span>
                  <span className={`gr ${p.aeoGrade === 'A' ? '' : p.aeoGrade}`}>{p.aeoGrade}</span>
                </div>
                <div className="path">
                  <span>/{p.city}/{p.category}/{p.slug}</span>
                  <span className="sep">·</span>
                  <span>언급 <b>{p.mentionCount}회</b></span>
                </div>
                {p.aeoRules.length > 0 && (() => {
                  const failed = p.aeoRules.filter((r) => !r.passed)
                  const passed = p.aeoRules.filter((r) => r.passed)
                  // 실패 우선(최대 2) + 통과로 채움(합계 3). 둘 다 보여 상태 한눈에.
                  const failSlot = failed.slice(0, 2)
                  const passSlot = passed.slice(0, 3 - failSlot.length)
                  const hiddenFail = failed.length - failSlot.length
                  return (
                    <div className="chips">
                      {failSlot.map((r) => (
                        <span key={r.id} className="c warn">⚠ {chipLabel(r)}</span>
                      ))}
                      {passSlot.map((r) => (
                        <span key={r.id} className="c ok">✓ {chipLabel(r)}</span>
                      ))}
                      {hiddenFail > 0 && <span className="c warn">+{hiddenFail}</span>}
                    </div>
                  )
                })()}
              </div>

              <div className="actions">
                <Link href={`/owner/places/${p.id}`}>
                  편집
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />
                  </svg>
                </Link>
                {p.status === 'active' && (
                  <a href={`/${p.city}/${p.category}/${p.slug}`} target="_blank" rel="noopener noreferrer">
                    공개
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path d="M7 17L17 7M7 7h10v10" />
                    </svg>
                  </a>
                )}
              </div>
            </article>
          )
        })
      )}
    </div>
  )
}
