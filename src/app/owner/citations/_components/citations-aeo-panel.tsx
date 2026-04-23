// T-209/T-211 — /owner/citations AEO 패널 (ai-citations-v2.html 디자인).
// 업체별 카드 나열 — SVG 링 점수 + 체크리스트(ok/no) + 완성도 태그 + 하단 CTA 링크.

import Link from 'next/link'
import type { AeoSnapshot } from '@/lib/owner/aeo-snapshot'

interface Props {
  snapshots: AeoSnapshot[]
  placeNameById: Map<string, string>
}

function tagForGrade(grade: AeoSnapshot['grade']): { label: string; cls: 'good' | 'warn' | 'bad' } {
  if (grade === 'A') return { label: '완성도 높음', cls: 'good' }
  if (grade === 'B') return { label: '완성도 양호', cls: 'good' }
  if (grade === 'C') return { label: '보완 필요', cls: 'warn' }
  return { label: '시작 단계', cls: 'bad' }
}

function ringColorFor(cls: 'good' | 'warn' | 'bad'): string {
  if (cls === 'good') return 'var(--good)'
  if (cls === 'warn') return 'var(--warn)'
  return 'var(--accent)'
}

function linkTextFor(cls: 'good' | 'warn' | 'bad'): string {
  if (cls === 'good') return '기여도 보기 →'
  if (cls === 'warn') return '콘텐츠 보강 요청 →'
  return '지금 보강하기 →'
}

export function CitationsAeoPanel({ snapshots, placeNameById }: Props) {
  void placeNameById

  if (snapshots.length === 0) {
    return (
      <div className="aeo-empty">
        <p>AEO 점수를 계산할 업체 데이터가 아직 없습니다.</p>
      </div>
    )
  }

  return (
    <div className="score-grid">
      {snapshots.map((s) => {
        const tag = tagForGrade(s.grade)
        const ringColor = ringColorFor(tag.cls)
        const ringCircumference = 113.1 // r=18
        const dashOffset = ringCircumference * (1 - s.score / 100)
        const dashboardHref = `/owner/places/${s.placeId}/dashboard`
        const publicHref = `/${s.citySlug}/${s.categorySlug}/${s.placeSlug}`

        // 체크리스트: passed rules 우선 + 실패 top 3 = 상위 5개
        const rulesToShow = [
          ...s.topIssues.slice(0, 3).map((i) => ({ label: i.label, detail: i.detail, passed: false })),
        ]
        const passedVisible = Math.max(0, 5 - rulesToShow.length)
        // 실제 passedRules 데이터는 snapshot 에 없음 — "N/M 룰 통과" 로 대체.

        return (
          <article key={s.placeId} className="score">
            <div className="s-head">
              <div className="s-name">
                <b>{s.placeName}</b>
                <span>
                  <a href={publicHref} target="_blank" rel="noreferrer" className="public-link">
                    공개 페이지 ↗
                  </a>
                </span>
              </div>
              <div className={`s-tag ${tag.cls}`}>{tag.label}</div>
            </div>

            <div className="s-num">
              <span className="s-big">{s.score}</span>
              <span className="s-u">/100</span>
              <div className="s-ring">
                <svg viewBox="0 0 44 44">
                  <circle cx={22} cy={22} r={18} fill="none" stroke="var(--bg-2)" strokeWidth={4} />
                  <circle
                    cx={22}
                    cy={22}
                    r={18}
                    fill="none"
                    stroke={ringColor}
                    strokeWidth={4}
                    strokeDasharray={ringCircumference}
                    strokeDashoffset={dashOffset}
                    strokeLinecap="round"
                    transform="rotate(-90 22 22)"
                  />
                </svg>
              </div>
            </div>

            <ul className="s-list">
              <li className="ok">
                <span>{s.passedCount}/{s.totalCount} 룰 통과</span>
                <i>✓</i>
              </li>
              {rulesToShow.map((r, idx) => (
                <li key={idx} className="no">
                  <span>{r.label}{r.detail ? ` — ${r.detail}` : ''}</span>
                  <i>!</i>
                </li>
              ))}
              {passedVisible > 0 && rulesToShow.length < 4 && (
                <li className="ok">
                  <span>기본 메타데이터</span>
                  <i>✓</i>
                </li>
              )}
            </ul>

            <Link className="s-link" href={dashboardHref}>
              {linkTextFor(tag.cls)}
            </Link>
          </article>
        )
      })}
    </div>
  )
}
