// /owner/citations — 접촉 유형별 분해 KPI 3 카드.
// 1) 응답 수 합계 (split bar) · 2) 직접 답변 · 3) 간접 노출

import type { OwnerBotSummary, OwnerPathSummaryRow } from '@/lib/owner/bot-stats'

interface Props {
  botSummary: OwnerBotSummary
  byPath: OwnerPathSummaryRow[]
  placeCount: number
  lastVisitIso: string | null
}

function timeAgo(iso: string | null, now: Date = new Date()): string {
  if (!iso) return '—'
  const ts = Date.parse(iso)
  if (!Number.isFinite(ts)) return '—'
  const diff = now.getTime() - ts
  const min = Math.floor(diff / 60_000)
  if (min < 1) return '방금'
  if (min < 60) return `${min}분 전`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}시간 전`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}일 전`
  return new Date(ts).toLocaleDateString('ko-KR')
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  return `${y}. ${m}. ${dd}. ${hh}:${mm}:${ss}`
}

export function CitationsKpiRow({ botSummary, byPath, placeCount, lastVisitIso }: Props) {
  const answer = botSummary.aiSearch.total
  const crawl = botSummary.aiTraining.total
  const grand = answer + crawl

  // 접촉된 업체 수 = byPath 에 등장한 고유 placeIds 수
  const touchedPlaces = new Set<string>()
  for (const r of byPath) for (const id of r.placeIds) touchedPlaces.add(id)
  const touchedCount = touchedPlaces.size

  // 직접 답변 경로/업체 계산 (attribution=='direct' = page_type='place' 업체 상세 URL 방문)
  const answerPaths = byPath.filter((r) => r.bySearch.chatgpt + r.bySearch.claude + r.bySearch.perplexity + r.bySearch.other > 0)
  const answerPlaces = new Set<string>()
  for (const r of answerPaths) for (const id of r.placeIds) answerPlaces.add(id)

  const crawlPaths = byPath.filter((r) => r.byTraining.chatgpt + r.byTraining.claude + r.byTraining.gemini + r.byTraining.other > 0)
  const crawlPlaces = new Set<string>()
  for (const r of crawlPaths) for (const id of r.placeIds) crawlPlaces.add(id)

  const answerPct = grand === 0 ? 0 : Math.round((answer / grand) * 100)
  const crawlPct = grand === 0 ? 0 : Math.round((crawl / grand) * 100)

  // split bar 비율
  const answerFlex = grand === 0 ? 1 : answer
  const crawlFlex = grand === 0 ? 1 : crawl

  return (
    <div className="kpi-row">
      <article className="cit-kpi">
        <div className="head">
          <span className="dt" style={{ background: 'var(--ink)' }} />
          <h3>응답 수 합계</h3>
          <small>실시간 + 크롤링</small>
        </div>
        <div className="num">
          <span className="big">{grand}</span>
          <span className="u">회</span>
        </div>
        <div>
          <div className="split" style={{ gridTemplateColumns: `${answerFlex}fr ${crawlFlex}fr` }}>
            <i className="a" />
            <i className="b" />
          </div>
          <div className="split-lg">
            <span><i style={{ background: 'var(--chat)' }} /> 직접 답변 <b>{answer}</b></span>
            <span><i style={{ background: 'var(--warn)' }} /> 학습 크롤링 <b>{crawl}</b></span>
          </div>
        </div>
        <div className="desc">
          AI 엔진이 내 업체 페이지와 접촉한 모든 이벤트 합산. <b>실시간 답변</b>은 사용자에게 직접 노출, <b>크롤링</b>은 학습·인덱싱 목적입니다.
        </div>
        <div className="cfoot">
          <span>마지막 발생 <span className="time">{formatDateTime(lastVisitIso)}</span></span>
          <span>업체 <b>{touchedCount} / {placeCount}</b> 접촉됨</span>
        </div>
      </article>

      <article className="cit-kpi">
        <div className="head">
          <span className="dt" style={{ background: 'var(--chat)' }} />
          <h3>직접 답변 <small style={{ fontWeight: 500, marginLeft: 4, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>(인용 포함)</small></h3>
        </div>
        <div className="num">
          <span className="big">{answer}</span>
          <span className="u">회</span>
          <span className={`pct ${answer > 0 ? 'good' : 'muted'}`}>{answerPct}%</span>
        </div>
        <div className="prog"><i style={{ width: `${answerPct}%`, background: 'var(--chat)' }} /></div>
        <div className="desc">
          AI 답변에서 내 업체가 <b>직접 인용</b>된 횟수. ChatGPT {botSummary.aiSearch.byEngine.chatgpt ?? 0}건 · Claude {botSummary.aiSearch.byEngine.claude ?? 0}건 · Perplexity {botSummary.aiSearch.byEngine.perplexity ?? 0}건.
        </div>
        <div className="cfoot">
          <span>업체 <b>{answerPlaces.size}곳</b> · 페이지 <b>{answerPaths.length}</b></span>
          <span>최근 <b>{timeAgo(botSummary.aiSearch.lastVisitAt)}</b></span>
        </div>
      </article>

      <article className="cit-kpi">
        <div className="head">
          <span className="dt" style={{ background: 'var(--warn)' }} />
          <h3>간접 노출 <small style={{ fontWeight: 500, marginLeft: 4, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>(학습·크롤링)</small></h3>
        </div>
        <div className="num">
          <span className="big">{crawl}</span>
          <span className="u">회</span>
          <span className={`pct ${crawl > 0 ? 'warn' : 'muted'}`}>{crawlPct}%</span>
        </div>
        <div className="prog"><i style={{ width: `${crawlPct}%`, background: 'var(--warn)' }} /></div>
        <div className="desc">
          AI 학습 봇이 페이지를 <b>수집/참고</b>한 횟수. GPTBot {botSummary.aiTraining.byEngine.chatgpt ?? 0}회 · ClaudeBot {botSummary.aiTraining.byEngine.claude ?? 0}회 · Gemini {botSummary.aiTraining.byEngine.gemini ?? 0}회.
        </div>
        <div className="cfoot">
          <span>업체 <b>{crawlPlaces.size}곳</b> · 페이지 <b>{crawlPaths.length}</b></span>
          <span>최근 <b>{timeAgo(botSummary.aiTraining.lastVisitAt)}</b></span>
        </div>
      </article>
    </div>
  )
}
