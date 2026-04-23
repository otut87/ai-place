// T-168 — /admin/consulting 관리자 페이지.
import { requireAuth } from '@/lib/auth'
import { getAdminClient } from '@/lib/supabase/admin-client'
import Link from 'next/link'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default async function ConsultingListPage() {
  await requireAuth()
  const admin = getAdminClient()
  if (!admin) return <div className="p-10">admin unavailable</div>

  const { data: engagements } = await admin
    .from('engagements')
    .select('id, target_url, status, client_name, contract_amount, started_at, completed_at, baseline_run_id, final_run_id')
    .order('started_at', { ascending: false })
    .limit(50)

  const list = (engagements ?? []) as Array<{
    id: string; target_url: string; status: string; client_name: string | null;
    contract_amount: number | null; started_at: string; completed_at: string | null;
    baseline_run_id: string | null; final_run_id: string | null;
  }>

  // 점수 배치 조회
  const runIds = [...new Set(list.flatMap(e => [e.baseline_run_id, e.final_run_id]).filter(Boolean) as string[])]
  const scoreMap = new Map<string, number>()
  if (runIds.length > 0) {
    const { data: runs } = await admin.from('diagnostic_runs').select('id, score').in('id', runIds)
    for (const r of (runs ?? []) as Array<{ id: string; score: number }>) scoreMap.set(r.id, r.score)
  }

  // 각 engagement 의 미완료 작업 수
  const engagementIds = list.map(e => e.id)
  const taskCountMap = new Map<string, number>()
  if (engagementIds.length > 0) {
    const { data: tasks } = await admin
      .from('engagement_tasks')
      .select('engagement_id, done')
      .in('engagement_id', engagementIds)
    for (const t of (tasks ?? []) as Array<{ engagement_id: string; done: boolean }>) {
      if (!t.done) taskCountMap.set(t.engagement_id, (taskCountMap.get(t.engagement_id) ?? 0) + 1)
    }
  }

  return (
    <div className="mx-auto max-w-5xl p-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">컨설팅 Engagements</h1>
          <p className="mt-1 text-xs text-[#6a6a6a]">프리미엄 고객 진행 상태 추적</p>
        </div>
        <Link href="/admin/consulting/new" className="rounded-lg bg-[#008060] px-4 py-2 text-xs font-medium text-white hover:bg-[#006e52]">
          + 새 engagement
        </Link>
      </header>

      {list.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#dddddd] p-10 text-center text-sm text-[#6a6a6a]">
          아직 진행 중인 engagement 가 없습니다.
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-xs text-[#6a6a6a]">
            <tr className="border-b border-[#e5e7eb]">
              <th className="py-2 text-left">클라이언트 / URL</th>
              <th className="py-2 text-left">상태</th>
              <th className="py-2 text-right">Baseline</th>
              <th className="py-2 text-right">Final</th>
              <th className="py-2 text-right">Δ</th>
              <th className="py-2 text-right">남은 작업</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {list.map(e => {
              const baselineScore = e.baseline_run_id ? scoreMap.get(e.baseline_run_id) ?? null : null
              const finalScore = e.final_run_id ? scoreMap.get(e.final_run_id) ?? null : null
              const delta = baselineScore !== null && finalScore !== null ? finalScore - baselineScore : null
              return (
                <tr key={e.id} className="border-b border-[#f0f0f0]">
                  <td className="py-3">
                    <div className="font-medium text-[#191919]">{e.client_name ?? '(이름 없음)'}</div>
                    <div className="text-xs text-[#6a6a6a]">{e.target_url}</div>
                  </td>
                  <td><StatusBadge status={e.status} /></td>
                  <td className="text-right text-xs">{baselineScore ?? '-'}</td>
                  <td className="text-right text-xs">{finalScore ?? '-'}</td>
                  <td className={`text-right text-xs font-semibold ${delta === null ? 'text-[#9a9a9a]' : delta > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {delta === null ? '-' : delta > 0 ? `+${delta}` : delta}
                  </td>
                  <td className="text-right text-xs">{taskCountMap.get(e.id) ?? 0}</td>
                  <td className="text-right">
                    <Link href={`/admin/consulting/${e.id}`} className="text-xs text-[#008060] underline">
                      상세
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    baseline: { label: 'Baseline', cls: 'bg-slate-100 text-slate-700' },
    in_progress: { label: '진행 중', cls: 'bg-blue-100 text-blue-700' },
    verification: { label: '검증', cls: 'bg-amber-100 text-amber-700' },
    completed: { label: '완료', cls: 'bg-emerald-100 text-emerald-700' },
    cancelled: { label: '취소', cls: 'bg-red-100 text-red-700' },
  }
  const v = map[status] ?? { label: status, cls: 'bg-gray-100 text-gray-600' }
  return <span className={`rounded px-2 py-0.5 text-[10px] ${v.cls}`}>{v.label}</span>
}
