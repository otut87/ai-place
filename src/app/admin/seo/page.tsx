// T-081 — /admin/seo — AI 봇 방문 로그.

import { requireAuth } from '@/lib/auth'
import { aggregateBotVisits, listRecentBotVisits } from '@/lib/admin/bot-visits'
import { AI_BOT_PATTERNS } from '@/lib/seo/bot-detection'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default async function AdminSeoPage() {
  await requireAuth()
  const [agg, recent] = await Promise.all([
    aggregateBotVisits(30),
    listRecentBotVisits(30),
  ])

  const labelById = new Map(AI_BOT_PATTERNS.map((p) => [p.id, p.label]))

  return (
    <div className="px-6 py-5">
      <header className="mb-5">
        <h1 className="text-xl font-semibold">AI 봇 방문 로그</h1>
        <p className="mt-1 text-sm text-[#6b6b6b]">
          GPTBot, ClaudeBot, PerplexityBot 등 AI 크롤러의 실제 방문 이력. 월간 리포트의 근거.
        </p>
      </header>

      <section className="mb-6">
        <h2 className="mb-3 text-sm font-medium text-[#191919]">최근 30일 봇별 합계</h2>
        {agg.length === 0 ? (
          <div className="rounded-xl border border-[#e7e7e7] bg-white p-6 text-sm text-[#6b6b6b]">
            아직 AI 봇 방문이 기록되지 않았습니다. 첫 크롤링까지 며칠~2주 소요됩니다.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {agg.map((row) => (
              <div key={row.botId} className="rounded-xl border border-[#e7e7e7] bg-white p-4">
                <div className="text-xs text-[#6b6b6b]">{labelById.get(row.botId) ?? row.botId}</div>
                <div className="mt-1 text-2xl font-semibold text-[#191919]">{row.visits.toLocaleString('ko-KR')}</div>
                <div className="mt-1 text-xs text-[#9a9a9a]">
                  최근: {row.lastVisitAt ? new Date(row.lastVisitAt).toLocaleString('ko-KR') : '—'}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

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
                  <th className="px-4 py-3 font-medium">경로</th>
                  <th className="px-4 py-3 font-medium">도시/업종</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0f0f0]">
                {recent.map((v) => (
                  <tr key={v.id} className="hover:bg-[#fafafa]">
                    <td className="px-4 py-3 text-xs text-[#6b6b6b]">{new Date(v.visited_at).toLocaleString('ko-KR')}</td>
                    <td className="px-4 py-3 font-medium text-[#191919]">{labelById.get(v.bot_id) ?? v.bot_id}</td>
                    <td className="px-4 py-3 font-mono text-xs text-[#6b6b6b]">{v.path}</td>
                    <td className="px-4 py-3 text-xs text-[#6b6b6b]">
                      {[v.city, v.category, v.place_slug].filter(Boolean).join(' / ') || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
