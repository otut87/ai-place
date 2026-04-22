// T-076 — /admin/pipelines — 파이프라인 작업 모니터링.

import { requireAuth } from '@/lib/auth'
import { listPipelineJobs, JOB_STATUS_LABEL, jobStatusTone, formatJobType } from '@/lib/admin/pipeline-jobs'
import { getLlmUsage, API_QUOTAS } from '@/lib/admin/pipeline-metrics'
import { RetryJobButton } from './retry-button'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default async function AdminPipelinesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireAuth()
  const raw = await searchParams
  const statusParam = asSingle(raw.status) ?? 'all'
  const jobTypeParam = asSingle(raw.job_type) ?? null

  const [rows, llm] = await Promise.all([
    listPipelineJobs({
      status: isStatus(statusParam) ? statusParam : 'all',
      jobType: jobTypeParam,
      limit: 100,
    }),
    getLlmUsage(7),
  ])

  return (
    <div className="px-6 py-5">
      <header className="mb-5">
        <h1 className="text-xl font-semibold">파이프라인</h1>
        <p className="mt-1 text-sm text-[#6b6b6b]">
          수집·생성·발행 작업의 상태. 실패 항목은 한 번에 재시도할 수 있습니다.
        </p>
      </header>

      {/* LLM 토큰·비용 (최근 7일) */}
      <section className="mb-6 rounded-xl border border-[#e7e7e7] bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">LLM 사용량 (최근 7일)</h2>
          <span className="text-xs text-[#6b6b6b]">ai_generations 기반 · 단가는 참고용</span>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <MiniStat label="호출" value={llm.total.calls.toLocaleString('ko-KR')} />
          <MiniStat label="입력 토큰" value={(llm.total.inputTokens / 1_000).toFixed(1) + 'K'} />
          <MiniStat label="출력 토큰" value={(llm.total.outputTokens / 1_000).toFixed(1) + 'K'} />
          <MiniStat label="예상 비용" value={'$' + llm.total.usdCost.toFixed(2)} />
        </div>
        {llm.daily.length > 0 && (
          <ul className="mt-3 space-y-1 border-t border-[#f0f0f0] pt-3 text-xs">
            {llm.daily.map(d => (
              <li key={d.date} className="flex items-center justify-between text-[#6b6b6b]">
                <span>{d.date}</span>
                <span>{d.calls}회 · {(d.inputTokens + d.outputTokens).toLocaleString('ko-KR')} 토큰 · ${d.usdCost.toFixed(2)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 수집 API 쿼터 (상한은 레퍼런스) */}
      <section className="mb-6 rounded-xl border border-[#e7e7e7] bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">수집 API 쿼터</h2>
          <span className="text-xs text-[#6b6b6b]">일일 상한 (레퍼런스)</span>
        </div>
        <ul className="grid gap-2 md:grid-cols-2">
          {API_QUOTAS.map(q => (
            <li key={q.name} className="flex items-center justify-between rounded-md border border-[#f0f0f0] px-3 py-2 text-sm">
              <span className="text-[#191919]">{q.name}</span>
              <span className="text-xs text-[#6b6b6b]">
                {q.dailyLimit.toLocaleString('ko-KR')}/일 · {process.env[q.envVar] ? '키 설정됨' : '키 없음'}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <form className="mb-4 flex items-center gap-2 text-sm" method="get">
        <select name="status" defaultValue={statusParam} className="h-9 rounded-md border border-[#e7e7e7] bg-white px-2">
          <option value="all">전체 상태</option>
          <option value="failed">실패</option>
          <option value="running">실행 중</option>
          <option value="pending">대기</option>
          <option value="succeeded">성공</option>
          <option value="canceled">취소</option>
        </select>
        <input
          type="text"
          name="job_type"
          defaultValue={jobTypeParam ?? ''}
          placeholder="job_type (예: collect)"
          className="h-9 rounded-md border border-[#e7e7e7] bg-white px-2"
        />
        <button type="submit" className="h-9 rounded-md bg-[#191919] px-3 text-white">적용</button>
      </form>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-[#e7e7e7] bg-white p-10 text-center text-sm text-[#6b6b6b]">
          작업이 없습니다.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[#e7e7e7] bg-white">
          <table className="w-full text-sm">
            <thead className="bg-[#fafafa] text-left text-xs uppercase tracking-wider text-[#6b6b6b]">
              <tr>
                <th className="px-4 py-3 font-medium">작업 타입</th>
                <th className="px-4 py-3 font-medium">대상</th>
                <th className="px-4 py-3 font-medium">상태</th>
                <th className="px-4 py-3 font-medium">재시도</th>
                <th className="px-4 py-3 font-medium">메시지</th>
                <th className="px-4 py-3 font-medium">시작/종료</th>
                <th className="px-4 py-3 font-medium">액션</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f0f0]">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-[#fafafa]">
                  <td className="px-4 py-3 font-medium text-[#191919]">
                    {formatJobType(r.job_type)}
                    <div className="font-mono text-[10px] text-[#9a9a9a]">{r.job_type}</div>
                  </td>
                  <td className="px-4 py-3 text-[#6b6b6b]">
                    {r.target_name ? (
                      <>
                        <div className="text-[#191919]">{r.target_name}</div>
                        {r.target_id && (
                          <div className="font-mono text-[10px] text-[#9a9a9a]">#{r.target_id.slice(0, 8)}</div>
                        )}
                      </>
                    ) : (
                      <>
                        {r.target_type ?? '—'}
                        {r.target_id ? <span className="ml-1 font-mono text-xs">#{r.target_id.slice(0, 8)}</span> : null}
                      </>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill status={r.status} />
                  </td>
                  <td className="px-4 py-3">{r.retried_count}회</td>
                  <td className="px-4 py-3 text-xs text-[#6b6b6b]">
                    {r.error ? <span className="text-red-600">{r.error}</span> : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-[#6b6b6b]">
                    {formatKst(r.started_at)}
                    {' → '}
                    {formatKst(r.finished_at)}
                  </td>
                  <td className="px-4 py-3">
                    <RetryJobButton jobId={r.id} disabled={r.status !== 'failed'} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[#f0f0f0] p-3">
      <div className="text-[10px] uppercase text-[#6b6b6b]">{label}</div>
      <div className="mt-1 text-lg font-semibold text-[#191919]">{value}</div>
    </div>
  )
}

function StatusPill({ status }: { status: keyof typeof JOB_STATUS_LABEL }) {
  const tone = jobStatusTone(status)
  const cls =
    tone === 'ok' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : tone === 'danger' ? 'bg-red-50 text-red-700 border-red-200'
    : tone === 'warn' ? 'bg-amber-50 text-amber-700 border-amber-200'
    : 'bg-[#f3f4f6] text-[#6b6b6b] border-[#e7e7e7]'
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${cls}`}>{JOB_STATUS_LABEL[status]}</span>
}

function asSingle(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0]
  return v
}

function isStatus(v: string): v is 'pending' | 'running' | 'succeeded' | 'failed' | 'canceled' | 'all' {
  return ['pending', 'running', 'succeeded', 'failed', 'canceled', 'all'].includes(v)
}

// DB timestamp → KST 포맷 (Vercel 서버 런타임이 UTC 라 명시 필요).
function formatKst(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}
