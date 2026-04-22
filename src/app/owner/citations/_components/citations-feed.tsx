// /owner/citations — 최근 AI 봇 방문 피드 (타임라인 형태).
// 좌측 도트 + 엔진 pill + 경로/업체/type + 시각.

import Link from 'next/link'
import type { OwnerBotVisit } from '@/lib/owner/bot-stats'

interface Props {
  visits: OwnerBotVisit[]
  placeNameById: Map<string, string>
  totalDays: number
}

function formatRelative(iso: string, now: Date = new Date()): string {
  const ts = Date.parse(iso)
  if (!Number.isFinite(ts)) return iso
  const diff = now.getTime() - ts
  const min = Math.floor(diff / 60_000)
  if (min < 1) return '방금 전'
  if (min < 60) return `${min}분 전`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}시간 전`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}일 전`
  const w = Math.floor(day / 7)
  return `${w}주 전`
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${m}-${dd} ${hh}:${mm}`
}

function engineColor(botId: string, group: string): string {
  if (group === 'ai-training') {
    if (botId.includes('gpt') || botId === 'gptbot') return 'var(--warn)'
    if (botId.includes('claude') || botId === 'anthropic-ai') return '#cc785c'
    if (botId === 'google-extended') return '#4285f4'
    return '#9a9a9a'
  }
  if (botId.includes('chatgpt') || botId.includes('oai')) return 'var(--chat)'
  if (botId.includes('claude')) return '#cc785c'
  if (botId.includes('perplexity')) return '#20808d'
  return '#9a9a9a'
}

export function CitationsFeed({ visits, placeNameById, totalDays }: Props) {
  const totalLabel = visits.length > 0
    ? `최근 ${totalDays}일 · ${visits.length}건`
    : `최근 ${totalDays}일`

  const answerCount = visits.filter((v) => v.group === 'ai-search').length
  const crawlCount = visits.filter((v) => v.group === 'ai-training').length

  return (
    <div className="dash-panel2 feed">
      <div className="phead">
        <h3>
          실시간 피드
          <small style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)', fontWeight: 500, marginLeft: 8 }}>
            {totalLabel}
          </small>
        </h3>
        {visits.length > 0 && (
          <div className="right">
            <div className="tabs">
              <a className="active" aria-current="page">전체 {visits.length}</a>
              <a>답변 {answerCount}</a>
              <a>크롤링 {crawlCount}</a>
            </div>
          </div>
        )}
      </div>

      {visits.length === 0 ? (
        <div className="empty">
          지난 {totalDays}일간 AI 봇 방문 기록이 없습니다.<br />
          AI 봇이 새 URL 을 발견하기까지 평균 3~10일 걸립니다.
        </div>
      ) : (
        visits.map((v) => {
          const color = engineColor(v.botId, v.group)
          const primaryName = v.placeIds[0] ? placeNameById.get(v.placeIds[0]) ?? '—' : '—'
          const restCount = v.placeIds.length - 1
          const type = v.group === 'ai-search' ? 'ANSWER' : 'CRAWL'
          const typeClass = v.group === 'ai-search' ? 'answer' : 'crawl'

          return (
            <div className="it" key={v.id}>
              <div className="tl"><span className="dot" style={{ background: color }} /></div>
              <span className="eng">
                <i style={{ background: color }} />
                {v.botLabel}
              </span>
              <div className="body">
                <Link href={v.path} className="pth" target="_blank" rel="noopener noreferrer">{v.path}</Link>
                <div className="biz">
                  <b>{primaryName}{restCount > 0 && ` +${restCount}곳`}</b>
                  <span className={`type ${typeClass}`}>{type}</span>
                  <span>{pageTypeLabel(v.pageType)}</span>
                </div>
              </div>
              <div className="when">
                <b>{formatRelative(v.visitedAt)}</b>
                <span>{formatTimestamp(v.visitedAt)}</span>
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}

function pageTypeLabel(t: string): string {
  switch (t) {
    case 'detail':  return '업체 상세'
    case 'blog':    return '블로그 본문'
    case 'compare': return '비교 콘텐츠'
    case 'guide':   return '가이드 콘텐츠'
    case 'keyword': return '키워드 랜딩'
    default:        return t
  }
}
