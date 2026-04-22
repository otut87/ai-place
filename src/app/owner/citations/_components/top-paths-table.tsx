// /owner/citations — 상위 방문 페이지 테이블 (Remix tpage).
// 1~5 rank serif + 경로 + 업체 + hit(막대) + 접촉 엔진.

import type { OwnerPathSummaryRow } from '@/lib/owner/bot-stats'

interface Props {
  rows: OwnerPathSummaryRow[]
  placeNameById: Map<string, string>
}

const ENGINE_LABELS: Record<string, { label: string; color: string }> = {
  'aiSearch.chatgpt':    { label: 'ChatGPT',    color: 'var(--chat)' },
  'aiSearch.claude':     { label: 'Claude',     color: '#cc785c' },
  'aiSearch.perplexity': { label: 'Perplexity', color: '#7a3f8f' },
  'aiSearch.other':      { label: '기타 답변',  color: '#9a9a9a' },
  'aiTraining.chatgpt':  { label: 'GPTBot',     color: 'var(--warn)' },
  'aiTraining.claude':   { label: 'ClaudeBot',  color: '#cc785c' },
  'aiTraining.gemini':   { label: 'Gemini',     color: '#4285f4' },
  'aiTraining.other':    { label: '기타 크롤', color: '#9a9a9a' },
}

function collectEngines(r: OwnerPathSummaryRow): Array<{ label: string; color: string; count: number }> {
  const items: Array<{ label: string; color: string; count: number }> = []
  for (const [key, count] of Object.entries(r.bySearch)) {
    if (count > 0) {
      const meta = ENGINE_LABELS[`aiSearch.${key}`]
      if (meta) items.push({ label: meta.label, color: meta.color, count })
    }
  }
  for (const [key, count] of Object.entries(r.byTraining)) {
    if (count > 0) {
      const meta = ENGINE_LABELS[`aiTraining.${key}`]
      if (meta) items.push({ label: meta.label, color: meta.color, count })
    }
  }
  return items.sort((a, b) => b.count - a.count)
}

function shortPath(path: string): string {
  if (path.length <= 48) return path
  return `${path.slice(0, 26)}…${path.slice(-20)}`
}

export function TopPathsTable({ rows, placeNameById }: Props) {
  const top = rows.slice(0, 5)
  const maxHit = top.length > 0 ? Math.max(1, ...top.map((r) => r.total)) : 1

  return (
    <div className="dash-panel2 tpage">
      <div className="phead">
        <h3>
          상위 방문 페이지
          {rows.length > 0 && (
            <small style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)', fontWeight: 500, marginLeft: 8 }}>
              {top.length}개 · 총 {rows.reduce((s, r) => s + r.total, 0)}건
            </small>
          )}
        </h3>
      </div>

      {top.length === 0 ? (
        <div className="empty">
          아직 집계된 방문이 없습니다. AI 봇이 새 URL 을 발견하기까지 평균 3~10일 걸립니다.
        </div>
      ) : (
        <>
          <div className="tprow head">
            <span>#</span>
            <span>경로</span>
            <span>업체</span>
            <span>건수</span>
            <span>접촉 엔진</span>
          </div>
          {top.map((r, idx) => {
            const rank = idx + 1
            const engines = collectEngines(r)
            const placeNames = r.placeIds.map((id) => placeNameById.get(id)).filter(Boolean) as string[]
            const primaryName = placeNames[0] ?? '—'
            const restCount = placeNames.length > 1 ? placeNames.length - 1 : 0
            const pct = (r.total / maxHit) * 100

            return (
              <div className="tprow" key={r.path}>
                <span className={`rk${rank <= 3 ? ' top' : ''}`}>{rank}</span>
                <div className="pth">
                  <a className="u" href={r.path} target="_blank" rel="noopener noreferrer" title={r.path}>
                    {shortPath(r.path)}
                  </a>
                  <span className="b">{pageTypeLabel(r.pageType)}</span>
                </div>
                <div className="biz">
                  {primaryName}
                  {restCount > 0 && <small>+{restCount}곳 추가 언급</small>}
                </div>
                <div className="hit">
                  {r.total}
                  <span className="bar"><i style={{ width: `${pct}%` }} /></span>
                </div>
                <div className="engs">
                  {engines.slice(0, 3).map((e) => (
                    <span className="c" key={e.label}>
                      <i style={{ background: e.color }} />
                      {e.label}×{e.count}
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}

function pageTypeLabel(t: string): string {
  switch (t) {
    case 'detail':  return '업체 상세 페이지'
    case 'blog':    return '블로그 본문'
    case 'compare': return '비교 콘텐츠'
    case 'guide':   return '가이드 콘텐츠'
    case 'keyword': return '키워드 랜딩'
    default:        return t
  }
}
