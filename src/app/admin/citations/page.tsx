// T-056 — AI 인용 추적 대시보드
import { listRecentCitations } from '@/lib/actions/citations'
import {
  summarizeByEngine,
  summarizeByPrompt,
  summarizeTrend,
  topCitedPlaces,
} from '@/lib/citations/aggregate'

export const dynamic = 'force-dynamic'

function pct(v: number) {
  return `${Math.round(v * 100)}%`
}

interface SearchParamsRaw {
  days?: string
}

export default async function CitationsPage({ searchParams }: { searchParams: Promise<SearchParamsRaw> }) {
  const raw = await searchParams
  const days = Math.max(1, Math.min(90, Number(raw.days) || 30))
  const rows = await listRecentCitations(days, 5000)

  const byEngine = summarizeByEngine(rows)
  const byPrompt = summarizeByPrompt(rows)
  const trend = summarizeTrend(rows)
  const topPlaces = topCitedPlaces(rows, 15)

  const maxTrendRate = Math.max(0.01, ...trend.map(t => t.rate))

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold">AI 인용 추적</h1>
          <p className="text-xs text-[#6a6a6a]">
            최근 {days}일 · 총 {rows.length}건 · scripts/baseline-test.ts 로 수집
          </p>
        </div>
        <nav className="flex gap-2 text-xs">
          {[7, 30, 60, 90].map(d => (
            <a
              key={d}
              href={`/admin/citations?days=${d}`}
              className={`rounded border px-2 py-1 ${d === days ? 'border-[#222222] bg-[#222222] text-white' : 'border-[#dddddd] text-[#484848]'}`}
            >
              {d}일
            </a>
          ))}
        </nav>
      </header>

      {/* 엔진별 집계 */}
      <section className="grid grid-cols-3 gap-3">
        {(['chatgpt', 'claude', 'gemini'] as const).map(engine => {
          const s = byEngine[engine]
          return (
            <div key={engine} className="rounded-lg border border-[#e5e7eb] bg-white p-4">
              <div className="text-xs font-medium uppercase text-[#6a6a6a]">{engine}</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-semibold">{pct(s.rate)}</span>
                <span className="text-xs text-[#6a6a6a]">{s.cited}/{s.total}</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#f3f4f6]">
                <div className="h-full rounded-full bg-[#4c1d95]" style={{ width: `${Math.min(100, s.rate * 100)}%` }} />
              </div>
            </div>
          )
        })}
      </section>

      {/* 일자별 추이 */}
      <section className="rounded-lg border border-[#e5e7eb] bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold">일자별 인용률 추이</h2>
        {trend.length === 0 ? (
          <p className="text-xs text-[#6a6a6a]">데이터가 아직 없습니다.</p>
        ) : (
          <div className="flex items-end gap-1 overflow-x-auto">
            {trend.map(t => (
              <div key={t.date} className="flex min-w-[36px] flex-col items-center gap-1">
                <div
                  className="w-6 rounded-t bg-[#4c1d95]"
                  style={{ height: `${(t.rate / maxTrendRate) * 80}px` }}
                  title={`${t.date} · ${pct(t.rate)} (${t.cited}/${t.total})`}
                />
                <span className="text-[9px] text-[#6a6a6a]">{t.date.slice(5)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* prompt × engine 매트릭스 */}
      <section className="rounded-lg border border-[#e5e7eb] bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold">프롬프트별 × 엔진별 인용률</h2>
        {byPrompt.size === 0 ? (
          <p className="text-xs text-[#6a6a6a]">데이터가 아직 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-left text-[#6a6a6a]">
                  <th className="py-1">Prompt ID</th>
                  <th>ChatGPT</th>
                  <th>Claude</th>
                  <th>Gemini</th>
                </tr>
              </thead>
              <tbody>
                {Array.from(byPrompt.entries())
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([promptId, s]) => (
                    <tr key={promptId} className="border-b last:border-0">
                      <td className="py-1 pr-2 font-mono text-[#484848]">{promptId}</td>
                      <td>{pct(s.chatgpt.rate)} <span className="text-[#6a6a6a]">({s.chatgpt.cited}/{s.chatgpt.total})</span></td>
                      <td>{pct(s.claude.rate)} <span className="text-[#6a6a6a]">({s.claude.cited}/{s.claude.total})</span></td>
                      <td>{pct(s.gemini.rate)} <span className="text-[#6a6a6a]">({s.gemini.cited}/{s.gemini.total})</span></td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 상위 언급 업체 */}
      <section className="rounded-lg border border-[#e5e7eb] bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold">최다 언급 업체 Top 15</h2>
        {topPlaces.length === 0 ? (
          <p className="text-xs text-[#6a6a6a]">데이터가 아직 없습니다.</p>
        ) : (
          <ol className="grid grid-cols-3 gap-2 text-xs">
            {topPlaces.map((p, i) => (
              <li key={p.name} className="flex items-center justify-between rounded bg-[#f5f3ff] px-2 py-1">
                <span>
                  <span className="mr-1 text-[#6a6a6a]">{i + 1}.</span>
                  <span className="font-medium">{p.name}</span>
                </span>
                <span className="text-[#4c1d95]">{p.count}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}
