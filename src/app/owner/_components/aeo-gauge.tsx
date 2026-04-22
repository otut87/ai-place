// Sprint D-2 / T-203 — AEO 점수 원형 게이지.
// scorePlaceAeo 의 8룰 결과를 시각화. 여러 업체가 있으면 가장 점수 낮은 업체 1곳을 선택
// (개선 여지가 가장 큰 곳). 업체 1곳이면 그 업체.

import Link from 'next/link'
import type { OwnerPlaceSummary } from '@/lib/owner/dashboard-data'

interface Props {
  places: OwnerPlaceSummary[]
  averageScore: number | null
}

function grade(score: number) {
  if (score >= 85) return 'A'
  if (score >= 75) return 'B'
  if (score >= 60) return 'C'
  return 'D'
}

export function AeoGauge({ places, averageScore }: Props) {
  if (places.length === 0 || averageScore === null) {
    return (
      <div className="dash-panel">
        <div className="head">
          <h3>AEO 점수</h3>
          <span className="chip muted">업체 등록 대기</span>
        </div>
        <div style={{ padding: 24, color: 'var(--muted)', fontSize: 13.5, textAlign: 'center' }}>
          업체를 등록하면 8룰 결정론 평가가 즉시 시작됩니다.
        </div>
      </div>
    )
  }

  // 최저 점수 업체 1곳 선정.
  const weakest = places.slice().sort((a, b) => a.aeoScore - b.aeoScore)[0]

  // 원 둘레: r=52 → 2πr ≈ 326.7. score/100 비율로 stroke-dasharray 채움.
  const r = 52
  const circumference = 2 * Math.PI * r
  const dash = (averageScore / 100) * circumference
  const g = grade(averageScore)

  // 8룰 상세 재계산 — placeSummary 에 rules 가 없어 deficiencies 만으로 대략 표시.
  // dashboard-data 에서 aeoDeficiencies 는 실패한 rule label 목록.
  // 전체 rule 목록(8개) 과 매칭해 pass/fail 표시.
  const ALL_RULES = allRulesSkeleton()
  const weakestFails = new Set(weakest.aeoDeficiencies)
  const ruleRows = ALL_RULES.map((r) => ({
    id: r.id,
    label: r.label,
    weight: r.weight,
    passed: !weakestFails.has(r.label),
  }))

  return (
    <div className="dash-panel">
      <div className="head">
        <h3>AEO 점수</h3>
        <span className={`grade-pill ${g}`}>{g}등급</span>
      </div>

      <div className="gauge">
        <div className="gauge-circle">
          <svg viewBox="0 0 120 120" width={120} height={120}>
            <circle cx={60} cy={60} r={r} fill="none" stroke="var(--bg-2)" strokeWidth={10} />
            <circle
              cx={60} cy={60} r={r} fill="none"
              stroke="var(--accent)" strokeWidth={10}
              strokeLinecap="round"
              strokeDasharray={`${dash.toFixed(1)} ${circumference.toFixed(1)}`}
            />
          </svg>
          <div className="val">
            <span className="n">{averageScore}</span>
            <span className="s">/ 100</span>
          </div>
        </div>
        <div className="gauge-desc">
          <b>{places.length === 1 ? weakest.name : `${places.length}곳 평균`}</b>
          <br />
          최저 <b>{weakest.name}</b> {weakest.aeoScore}점 · {weakest.aeoGrade}등급
          {weakest.aeoDeficiencies[0] && (
            <>
              <br />
              다음: <b style={{ color: 'var(--accent)' }}>{weakest.aeoDeficiencies[0]}</b>
            </>
          )}
        </div>
      </div>

      <hr className="rule" style={{ margin: '14px 0' }} />

      <div className="gauge-rules" aria-label={`${weakest.name} 8룰 평가`}>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>
          {weakest.name} 상세
        </div>
        {ruleRows.map((r) => (
          <div key={r.id} className={`rule-row ${r.passed ? 'pass' : 'fail'}`}>
            <span className="lbl">{r.label}</span>
            <span className="w">+{r.weight}</span>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 12, fontSize: 12 }}>
        <Link href={`/owner/places/${weakest.id}`} style={{ color: 'var(--accent)', fontFamily: 'var(--mono)' }}>
          → {weakest.name} 편집
        </Link>
      </div>
    </div>
  )
}

/**
 * 8룰의 라벨·가중치 skeleton. place-aeo-score.ts 와 동기화 (label 문자열 일치).
 */
function allRulesSkeleton() {
  // scorePlaceAeo 와 1:1 매칭. label 이 dashboard-data.aeoDeficiencies 와 비교되는 키.
  return [
    { id: 'jsonld-basics',        label: 'JSON-LD 기본 (이름·주소·연락처)', weight: 20 },
    { id: 'faq-count',            label: 'FAQ 3~10개',                      weight: 20 },
    { id: 'freshness',            label: '최근 갱신 표시 (180일 이내)',      weight: 10 },
    { id: 'review-summary',       label: '리뷰 표시/수집',                  weight: 10 },
    { id: 'photos-3',             label: '대표 사진 3장 이상',               weight: 10 },
    { id: 'opening-hours',        label: '영업시간 정확',                   weight: 10 },
    { id: 'services-min',         label: '서비스 1가지 이상',                weight: 10 },
    { id: 'mentioned-in-content', label: '브랜드·카테고리·지역 언급',        weight: 10 },
  ]
}

