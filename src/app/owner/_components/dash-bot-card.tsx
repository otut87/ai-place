// /owner 홈 — 최근 AI 봇 방문. 기록 있으면 리스트, 없으면 일러스트 + 봇 preview.

import Link from 'next/link'
import type { OwnerBotVisit } from '@/lib/owner/bot-stats'

function formatTs(iso: string, now: Date = new Date()): string {
  const ts = Date.parse(iso)
  if (!Number.isFinite(ts)) return iso
  const diff = now.getTime() - ts
  const min = Math.floor(diff / 60_000)
  if (min < 1) return '방금'
  if (min < 60) return `${min}분 전`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}시간 전`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}일 전`
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function engineColor(botId: string): string {
  if (botId.includes('gpt') || botId.includes('chatgpt') || botId.includes('oai')) return '#10a37f'
  if (botId.includes('claude') || botId === 'anthropic-ai') return '#cc785c'
  if (botId === 'google-extended' || botId.includes('gemini')) return '#4285f4'
  if (botId.includes('perplexity')) return '#20808d'
  return '#9a9a9a'
}

interface Props {
  visits: OwnerBotVisit[]
  totalDays: number
}

export function DashBotCard({ visits, totalDays }: Props) {
  return (
    <div className="dash-panel2 bot-card">
      <div className="phead">
        <h3>최근 AI 봇 방문</h3>
        <div className="dash-total">{totalDays}일 · <b>{visits.length}건</b></div>
      </div>

      {visits.length === 0 ? (
        <div className="empty">
          <div className="ill">
            <svg viewBox="0 0 96 96" fill="none">
              <rect x={20} y={28} width={56} height={44} rx={12} fill="#fff" stroke="#ff5c2b" strokeWidth={2} />
              <circle cx={36} cy={48} r={4} fill="#ff5c2b" />
              <circle cx={60} cy={48} r={4} fill="#ff5c2b" />
              <path d="M36 60c4 4 20 4 24 0" stroke="#ff5c2b" strokeWidth={2} strokeLinecap="round" />
              <path d="M48 14v14" stroke="#ff5c2b" strokeWidth={2} strokeLinecap="round" />
              <circle cx={48} cy={12} r={3} fill="#ff5c2b" />
              <path d="M14 46h6M76 46h6" stroke="#ff5c2b" strokeWidth={2} strokeLinecap="round" />
            </svg>
          </div>
          <b>지난 {totalDays}일간 AI 봇 방문 기록이 없습니다</b>
          <p>AI 봇이 새 URL 을 발견하기까지 평균 3~10일 · 업체 등록 후 차차 기록이 쌓입니다.</p>
          <div className="bots-preview">
            <span><i style={{ background: '#10a37f' }} /> GPTBot</span>
            <span><i style={{ background: '#cc785c' }} /> ClaudeBot</span>
            <span><i style={{ background: '#4285f4' }} /> Google-Extended</span>
            <span><i style={{ background: '#20808d' }} /> PerplexityBot</span>
          </div>
        </div>
      ) : (
        <div className="bot-list">
          {visits.slice(0, 8).map((v) => (
            <div key={v.id} className="bot-row">
              <span className="eng">
                <i style={{ background: engineColor(v.botId) }} /> {v.botLabel}
              </span>
              <span className="path">
                <a href={v.path} target="_blank" rel="noopener noreferrer">{v.path}</a>
              </span>
              <span className="type">{v.attribution === 'direct' ? '직접' : '언급'}</span>
              <span className="ts">{formatTs(v.visitedAt)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="bot-foot">
        <span>로그 연동 상태 <b style={{ color: 'var(--ink)', fontWeight: 600 }}>활성</b></span>
        <Link href="/owner/citations">전체 보기 →</Link>
      </div>
    </div>
  )
}
