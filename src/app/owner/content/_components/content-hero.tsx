// /owner/content hero — 검정 카드.
// 기능: kicker(최근 발행+누적), headline, lede, 타입 칩, 타입 분포 패널.
// 기준: 파이프라인 4종 (detail/compare/guide/keyword). post_type='general' 은 otherCount.
// 허수 금지: counts=0 이면 off 스타일 + "아직 발행 예정 없음" 문구.

import type { ContentTabKey } from '@/lib/owner/content-mentions'

interface Props {
  /** 탭별 누적 건수 — loadOwnerContent 가 채움. */
  counts: Record<ContentTabKey, number>
  /** 전체 건수 = counts 합 + general 등 미분류 건. */
  totalCount: number
  /** 가장 최근 콘텐츠의 sortKey — kicker 에 "최근 발행일" 로 표시. */
  latestSortKey: string | null
}

const TAB_DEFS: Array<{ key: ContentTabKey; label: string; hint: string; color: string }> = [
  { key: 'detail',  label: '업체 정보',     hint: '특정 업체 1곳 심층',     color: 'var(--accent-2)' },
  { key: 'compare', label: '비교',          hint: '업체 vs 업체',          color: 'color-mix(in oklab, var(--accent-2) 70%, var(--accent))' },
  { key: 'guide',   label: '가이드',        hint: '시술·서비스별 선택',    color: 'color-mix(in oklab, var(--accent-2) 35%, var(--accent))' },
  { key: 'keyword', label: '키워드 페이지', hint: '지역+업종 랜딩',        color: 'var(--accent)' },
]

function formatKickerDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

export function ContentHero({ counts, totalCount, latestSortKey }: Props) {
  const kickerDate = formatKickerDate(latestSortKey)
  const kicker = totalCount > 0
    ? `${kickerDate ? `최근 발행 · ${kickerDate}` : '발행 시작'} · 누적 ${totalCount}건`
    : '발행 대기 중'

  const zeros = TAB_DEFS.filter((t) => counts[t.key] === 0).map((t) => t.label)
  const nonZeros = TAB_DEFS.filter((t) => counts[t.key] > 0)
  const tabsSum = counts.detail + counts.compare + counts.guide + counts.keyword
  const otherCount = Math.max(0, totalCount - tabsSum)

  return (
    <section className="c-hero">
      <div>
        <p className="kicker">{kicker}</p>
        <h1>
          내가 언급된 <span className="serif">콘텐츠</span><br />
          <span className="hi">{totalCount}건</span>
        </h1>
        <p className="lede">
          {totalCount === 0 ? (
            <>
              AI Place 편집팀이 발행하는 블로그(업체 정보·비교·가이드·키워드)에 아직 내 업체가 등장하지 않았습니다.
              <span className="zero"> 업체 등록 후 주 단위로 반영됩니다.</span>
            </>
          ) : (
            <>
              {nonZeros.map((t, i) => (
                <span key={t.key}>
                  {i === 0 ? '' : ' · '}
                  <b>{t.label} {counts[t.key]}건</b>
                </span>
              ))}
              {otherCount > 0 && (
                <>{nonZeros.length > 0 ? ' · ' : ''}<b>일반 {otherCount}건</b></>
              )}
              {' '}에 내 업체가 노출되어 있습니다.
              {zeros.length > 0 && (
                <span className="zero"> {zeros.join('·')} 은(는) 아직 발행 예정이 없습니다.</span>
              )}
            </>
          )}
        </p>
        <div className="chips">
          {TAB_DEFS.map((t) => {
            const n = counts[t.key]
            const off = n === 0
            return (
              <span key={t.key} className={off ? 'off' : undefined}>
                <i style={{ background: off ? 'color-mix(in oklab,#fff 30%, transparent)' : t.color }} />
                {t.label} <b>{n}</b>
              </span>
            )
          })}
        </div>
      </div>

      <div className="divide" />

      <div className="dist">
        <h4>블로그 타입 분포</h4>
        <TypeBar counts={counts} total={tabsSum + otherCount} otherCount={otherCount} />
        <div className="rows">
          {TAB_DEFS.map((t) => {
            const n = counts[t.key]
            const off = n === 0
            const pct = totalCount > 0 ? Math.round((n / totalCount) * 100) : 0
            return (
              <div key={t.key} className={`r${off ? ' off' : ''}`}>
                <span className="d" style={{ background: off ? 'color-mix(in oklab,#fff 30%, transparent)' : t.color }} />
                <span className="l">
                  {t.label}
                  <span className="n">{t.hint}</span>
                </span>
                <span className="pct">{off ? '—' : `${pct}%`}</span>
                <span className="v">{n}</span>
              </div>
            )
          })}
          {otherCount > 0 && (
            <div className="r">
              <span className="d" style={{ background: 'color-mix(in oklab,#fff 40%, transparent)' }} />
              <span className="l">
                일반
                <span className="n">수동 작성 · 탭 밖</span>
              </span>
              <span className="pct">{totalCount > 0 ? `${Math.round((otherCount / totalCount) * 100)}%` : '—'}</span>
              <span className="v">{otherCount}</span>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function TypeBar({ counts, total, otherCount }: { counts: Record<ContentTabKey, number>; total: number; otherCount: number }) {
  if (total === 0) {
    return <div className="bar" aria-hidden="true" />
  }
  return (
    <div className="bar">
      {TAB_DEFS.map((t) => {
        const n = counts[t.key]
        if (n === 0) return null
        const pct = (n / total) * 100
        return <i key={t.key} className={t.key} style={{ width: `${pct}%` }} />
      })}
      {otherCount > 0 && (
        <i
          style={{
            width: `${(otherCount / total) * 100}%`,
            background: 'color-mix(in oklab, #fff 40%, transparent)',
          }}
        />
      )}
    </div>
  )
}
