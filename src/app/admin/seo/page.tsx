// T-081 — /admin/seo — AI 봇 방문 로그.
// 섹션:
//   1) 상단 상태 카드 (총/200/404/404%)
//   2) 봇 그룹 요약 (AI 학습 / AI 검색 / 정규 검색 / 기타)
//   3) 일자별 방문 추이 (14일 스택 바)
//   4) 봇별 합계 카드
//   5) Top 크롤 경로 / 404 Top 경로 (2열)
//   6) 최근 방문 내역 (상태·UA 포함)

import { requireAuth } from '@/lib/auth'
import {
  aggregateBotVisits,
  listRecentBotVisits,
  aggregateBotStatus,
  topBot404Paths,
  topCrawledPaths,
  aggregateByGroup,
  dailyVisitTrend,
} from '@/lib/admin/bot-visits'
import { AI_BOT_PATTERNS, BOT_GROUP_LABEL, type BotGroup } from '@/lib/seo/bot-detection'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const GROUP_COLORS: Record<BotGroup, string> = {
  'ai-training':   '#10b981',   // emerald — AI 학습
  'ai-search':     '#3b82f6',   // blue — AI 검색
  'search':        '#f59e0b',   // amber — 정규 검색
  'crawler-other': '#9ca3af',   // gray — 기타
}

export default async function AdminSeoPage() {
  await requireAuth()
  const [agg, recent, status, top404, topPaths, groups, trend] = await Promise.all([
    aggregateBotVisits(30),
    listRecentBotVisits(50),
    aggregateBotStatus(30),
    topBot404Paths(30, 10),
    topCrawledPaths(30, 10),
    aggregateByGroup(30),
    dailyVisitTrend(14),
  ])

  const labelById = new Map(AI_BOT_PATTERNS.map((p) => [p.id, p.label]))
  const groupById = new Map(AI_BOT_PATTERNS.map((p) => [p.id, p.group]))
  const trendMax = Math.max(1, ...trend.map((d) => d.total))

  return (
    <div className="px-6 py-5">
      <header className="mb-5">
        <h1 className="text-xl font-semibold">AI 봇 방문 로그</h1>
        <p className="mt-1 text-sm text-[#6b6b6b]">
          GPTBot, ClaudeBot, PerplexityBot 등 AI 크롤러의 실제 방문 이력. 월간 리포트의 근거.
        </p>
      </header>

      {/* 1) 상태 카드 */}
      <section className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatusCard label="총 방문 (30d)" value={status.total.toLocaleString('ko-KR')} />
        <StatusCard label="200 OK" value={status.status200.toLocaleString('ko-KR')} tone="ok" />
        <StatusCard label="404" value={status.status404.toLocaleString('ko-KR')} tone={status.status404 > 0 ? 'danger' : 'muted'} />
        <StatusCard label="404 비율" value={`${(status.rate404 * 100).toFixed(1)}%`} tone={status.rate404 > 0.05 ? 'danger' : 'muted'} />
      </section>

      {/* 2) 그룹 요약 */}
      <section className="mb-6">
        <h2 className="mb-3 text-sm font-medium text-[#191919]">봇 그룹별 요약 (30일)</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {groups.map((g) => (
            <div key={g.group} className="rounded-xl border border-[#e7e7e7] bg-white p-4">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: GROUP_COLORS[g.group] }} />
                <span className="text-xs text-[#6b6b6b]">{BOT_GROUP_LABEL[g.group]}</span>
              </div>
              <div className="mt-1 text-2xl font-semibold text-[#191919]">{g.visits.toLocaleString('ko-KR')}</div>
              <div className="mt-1 text-xs text-[#9a9a9a]">
                유니크 봇 {g.uniqueBots} · 최근 {g.lastVisitAt ? new Date(g.lastVisitAt).toLocaleDateString('ko-KR') : '—'}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 3) 일자별 추이 */}
      <section className="mb-6 rounded-xl border border-[#e7e7e7] bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-[#191919]">일자별 방문 추이 (14일)</h2>
          <div className="flex items-center gap-3 text-xs text-[#6b6b6b]">
            {(['ai-training', 'ai-search', 'search', 'crawler-other'] as const).map((g) => (
              <span key={g} className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: GROUP_COLORS[g] }} />
                {BOT_GROUP_LABEL[g]}
              </span>
            ))}
          </div>
        </div>
        <div className="flex h-32 items-end gap-1">
          {trend.map((d) => {
            const heightPct = (d.total / trendMax) * 100
            const mmdd = d.date.slice(5).replace('-', '/')
            return (
              <div key={d.date} className="group relative flex flex-1 flex-col items-center justify-end">
                <div className="invisible absolute -top-16 z-10 whitespace-nowrap rounded-md bg-[#191919] px-2 py-1 text-[11px] text-white group-hover:visible">
                  {d.date} · 총 {d.total}
                  {(['ai-training', 'ai-search', 'search', 'crawler-other'] as const).map((g) =>
                    d.byGroup[g] > 0 ? <div key={g}>{BOT_GROUP_LABEL[g]} {d.byGroup[g]}</div> : null,
                  )}
                </div>
                <div className="flex w-full flex-col-reverse overflow-hidden rounded-sm" style={{ height: `${Math.max(heightPct, d.total === 0 ? 0 : 2)}%` }}>
                  {(['ai-training', 'ai-search', 'search', 'crawler-other'] as const).map((g) => {
                    const pct = d.total === 0 ? 0 : (d.byGroup[g] / d.total) * 100
                    return pct > 0 ? (
                      <div key={g} style={{ height: `${pct}%`, backgroundColor: GROUP_COLORS[g] }} />
                    ) : null
                  })}
                </div>
                <div className="mt-1 text-[10px] text-[#9a9a9a]">{mmdd}</div>
              </div>
            )
          })}
        </div>
      </section>

      {/* 4) 봇별 카드 */}
      <section className="mb-6">
        <h2 className="mb-3 text-sm font-medium text-[#191919]">봇별 합계 (30일)</h2>
        {agg.length === 0 ? (
          <div className="rounded-xl border border-[#e7e7e7] bg-white p-6 text-sm text-[#6b6b6b]">
            아직 AI 봇 방문이 기록되지 않았습니다. 첫 크롤링까지 며칠~2주 소요됩니다.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {agg.map((row) => {
              const g = groupById.get(row.botId) ?? 'crawler-other'
              return (
                <div key={row.botId} className="rounded-xl border border-[#e7e7e7] bg-white p-4">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: GROUP_COLORS[g] }} />
                    <div className="text-xs text-[#6b6b6b]">{labelById.get(row.botId) ?? row.botId}</div>
                  </div>
                  <div className="mt-1 text-2xl font-semibold text-[#191919]">{row.visits.toLocaleString('ko-KR')}</div>
                  <div className="mt-1 text-xs text-[#9a9a9a]">
                    최근: {row.lastVisitAt ? new Date(row.lastVisitAt).toLocaleString('ko-KR') : '—'}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* 5) Top 경로 (크롤 / 404) */}
      <section className="mb-6 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-[#e7e7e7] bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold">많이 크롤된 경로 Top 10</h2>
          {topPaths.length === 0 ? (
            <p className="text-sm text-[#9a9a9a]">데이터 없음</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {topPaths.map((p) => (
                <li key={p.path} className="flex items-center justify-between gap-2 text-[#6b6b6b]">
                  <span className="truncate font-mono text-xs" title={p.path}>{p.path}</span>
                  <span className="flex items-center gap-2 whitespace-nowrap">
                    <span className="text-[#9a9a9a] text-[10px]">{p.bots.length}봇</span>
                    <span className="text-emerald-700">{p.count}회</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-xl border border-[#e7e7e7] bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold">404 Top 10 경로</h2>
          {top404.length === 0 ? (
            <p className="text-sm text-[#9a9a9a]">404 없음</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {top404.map((p) => (
                <li key={p.path} className="flex items-center justify-between gap-2 text-[#6b6b6b]">
                  <span className="truncate font-mono text-xs" title={p.path}>{p.path}</span>
                  <span className="whitespace-nowrap text-red-600">{p.count}회</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* 6) 최근 방문 내역 */}
      <section>
        <h2 className="mb-3 text-sm font-medium text-[#191919]">최근 방문 내역</h2>
        {recent.length === 0 ? (
          <div className="rounded-xl border border-[#e7e7e7] bg-white p-6 text-sm text-[#6b6b6b]">기록 없음</div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-[#e7e7e7] bg-white">
            <table className="w-full text-sm">
              <thead className="bg-[#fafafa] text-left text-xs uppercase tracking-wider text-[#6b6b6b]">
                <tr>
                  <th className="px-4 py-3 font-medium">시각</th>
                  <th className="px-4 py-3 font-medium">봇</th>
                  <th className="px-4 py-3 font-medium">상태</th>
                  <th className="px-4 py-3 font-medium">경로</th>
                  <th className="px-4 py-3 font-medium">도시/업종</th>
                  <th className="px-4 py-3 font-medium">User-Agent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0f0f0]">
                {recent.map((v) => {
                  const g = groupById.get(v.bot_id) ?? 'crawler-other'
                  return (
                    <tr key={v.id} className="hover:bg-[#fafafa]">
                      <td className="px-4 py-3 text-xs text-[#6b6b6b] whitespace-nowrap">
                        {new Date(v.visited_at).toLocaleString('ko-KR')}
                      </td>
                      <td className="px-4 py-3 font-medium text-[#191919]">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: GROUP_COLORS[g] }} />
                          {labelById.get(v.bot_id) ?? v.bot_id}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <StatusBadge status={v.status} />
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-[#6b6b6b]">{v.path}</td>
                      <td className="px-4 py-3 text-xs text-[#6b6b6b]">
                        {[v.city, v.category, v.place_slug].filter(Boolean).join(' / ') || '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-[#9a9a9a]">
                        <span className="inline-block max-w-[280px] truncate font-mono" title={v.user_agent ?? ''}>
                          {v.user_agent ?? '—'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

function StatusCard({ label, value, tone = 'muted' }: { label: string; value: string; tone?: 'ok' | 'danger' | 'muted' }) {
  const cls =
    tone === 'ok' ? 'text-emerald-700' :
    tone === 'danger' ? 'text-red-700' :
    'text-[#191919]'
  return (
    <div className="rounded-xl border border-[#e7e7e7] bg-white p-4">
      <div className="text-xs text-[#6b6b6b]">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${cls}`}>{value}</div>
    </div>
  )
}

function StatusBadge({ status }: { status: number | null }) {
  if (status == null) return <span className="text-[#9a9a9a]">—</span>
  if (status === 200) return <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">200</span>
  if (status === 404) return <span className="rounded-full bg-red-50 px-2 py-0.5 text-red-700">404</span>
  if (status >= 500) return <span className="rounded-full bg-red-50 px-2 py-0.5 text-red-700">{status}</span>
  if (status >= 300 && status < 400) return <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">{status}</span>
  return <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-neutral-700">{status}</span>
}
