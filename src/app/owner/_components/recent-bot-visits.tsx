// Sprint D-2 / T-203 — 최근 AI 봇 방문 이력 테이블 (ai-search/ai-training).
// D<15 오버레이는 상위에서 감싸는 쪽이 담당.

import type { OwnerBotVisit } from '@/lib/owner/bot-stats'

interface Props {
  visits: OwnerBotVisit[]
  measuring: boolean
  measuringLabel: string
}

function formatTs(iso: string, now: Date = new Date()): string {
  const ts = Date.parse(iso)
  if (!Number.isFinite(ts)) return iso
  const diffMs = now.getTime() - ts
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1) return '방금'
  if (diffMin < 60) return `${diffMin}분 전`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}시간 전`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 7) return `${diffDay}일 전`
  // 7일 이상은 MM-DD 형식
  const d = new Date(ts)
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${month}-${day}`
}

function engineAiLogoClass(botId: string): string {
  if (botId.includes('chatgpt') || botId.includes('oai') || botId === 'gptbot') return 'gpt'
  if (botId.includes('claude') || botId === 'anthropic-ai') return 'claude'
  if (botId.includes('perplexity')) return 'perplexity'
  if (botId === 'google-extended') return 'gemini'
  return ''
}

export function RecentBotVisits({ visits, measuring, measuringLabel }: Props) {
  return (
    <div className="dash-panel" style={{ position: 'relative' }}>
      <div className="head">
        <h3>최근 AI 봇 방문</h3>
        {visits.length > 0 && (
          <span className="chip muted">최대 10건 · 30일 내</span>
        )}
      </div>

      <table className="bot-table">
        <thead>
          <tr>
            <th style={{ width: 160 }}>봇</th>
            <th>경로</th>
            <th style={{ width: 100 }}>유형</th>
            <th style={{ width: 90 }}>시각</th>
          </tr>
        </thead>
        <tbody>
          {visits.length === 0 ? (
            <tr>
              <td colSpan={4} className="empty">
                {measuring
                  ? `측정 중 · ${measuringLabel} · 아직 기록된 방문이 없어요.`
                  : '지난 30일간 AI 봇 방문 기록이 없습니다.'}
              </td>
            </tr>
          ) : (
            visits.map((v) => {
              const logoCls = engineAiLogoClass(v.botId)
              return (
                <tr key={v.id}>
                  <td className="eng">
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      {logoCls && (
                        <span
                          className={`ai-logo ${logoCls}`}
                          aria-hidden="true"
                          style={{ width: 18, height: 18, fontSize: 0, flex: '0 0 18px' }}
                        />
                      )}
                      {v.botLabel}
                    </span>
                  </td>
                  <td className="path">
                    <a
                      href={v.path}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: 'inherit', textDecoration: 'underline' }}
                    >
                      {v.path}
                    </a>
                  </td>
                  <td>
                    <span className={`type-chip ${v.attribution}`}>
                      {v.attribution === 'direct' ? '🟢 직접' : '🟡 언급'}
                    </span>
                  </td>
                  <td className="ts">{formatTs(v.visitedAt)}</td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>

      {visits.length > 0 && (
        <div className="bot-table-note">
          ※ 크롤링은 인용을 보장하지 않습니다. 실제 AI 답변에서 인용됐는지는 GPT·Claude·Perplexity 에 직접 질문해 확인해 주세요.
        </div>
      )}

      {measuring && visits.length > 0 && (
        <div className="measuring-overlay" role="status">
          <div className="body">
            <div className="big">측정 중 · {measuringLabel}</div>
            <div className="sub">15일 이후 실제 방문 이력이 공개됩니다.</div>
          </div>
        </div>
      )}
    </div>
  )
}
