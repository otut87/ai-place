// Admin — 신고 접수 목록 + 상태 업데이트.
import { requireAuth } from '@/lib/auth'
import { getAdminClient } from '@/lib/supabase/admin-client'
import { ReportRowActions } from './report-row-actions'

export const dynamic = 'force-dynamic'

const REASON_LABEL: Record<string, string> = {
  closed: '폐업',
  wrong_info: '잘못된 정보',
  spam: '스팸·광고',
  duplicate: '중복',
  inappropriate: '부적절',
  other: '기타',
}

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  pending: { label: '대기', className: 'bg-[#fef3c7] text-[#92400e]' },
  reviewed: { label: '검토중', className: 'bg-[#dbeafe] text-[#1e40af]' },
  resolved: { label: '해결', className: 'bg-[#d1fae5] text-[#065f46]' },
  dismissed: { label: '기각', className: 'bg-[#f3f4f6] text-[#484848]' },
}

export default async function AdminReportsPage() {
  await requireAuth()
  const admin = getAdminClient()
  if (!admin) return <div className="p-6 text-red-600">DB 연결 실패</div>

  const { data } = await admin
    .from('place_reports')
    .select(`
      id, place_id, reason, detail, reporter_email, status, admin_note, created_at, reviewed_at,
      places:place_id(name, city, category, slug)
    `)
    .order('created_at', { ascending: false })
    .limit(100)

  const rows = ((data ?? []) as unknown as Array<{
    id: string; place_id: string; reason: string; detail: string | null
    reporter_email: string | null; status: string; admin_note: string | null
    created_at: string; reviewed_at: string | null
    places: { name: string; city: string; category: string; slug: string } | null | Array<{ name: string; city: string; category: string; slug: string }>
  }>).map(r => ({
    ...r,
    places: Array.isArray(r.places) ? (r.places[0] ?? null) : r.places,
  }))

  return (
    <div className="mx-auto max-w-5xl p-6">
      <header className="mb-6">
        <h1 className="text-xl font-semibold">🚩 신고 접수 ({rows.length}건)</h1>
        <p className="mt-1 text-xs text-[#6a6a6a]">업체 정보 오류·폐업·스팸 신고 — 최근 100건</p>
      </header>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[#dddddd] p-8 text-center text-sm text-[#6a6a6a]">
          접수된 신고가 없습니다.
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map(r => {
            const st = STATUS_LABEL[r.status] ?? { label: r.status, className: 'bg-[#f3f4f6]' }
            return (
              <li key={r.id} className="rounded-lg border border-[#e5e7eb] bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] ${st.className}`}>{st.label}</span>
                      <span className="text-xs font-medium text-[#c2410c]">{REASON_LABEL[r.reason] ?? r.reason}</span>
                      {r.places ? (
                        <a
                          href={`/${r.places.city}/${r.places.category}/${r.places.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-[#222222] hover:text-[#008060] underline"
                        >
                          {r.places.name}
                        </a>
                      ) : (
                        <span className="text-sm text-[#9a9a9a]">[삭제된 업체]</span>
                      )}
                    </div>
                    {r.detail && (
                      <p className="mt-2 whitespace-pre-wrap text-sm text-[#484848]">{r.detail}</p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-[#9a9a9a]">
                      <span>접수: {new Date(r.created_at).toLocaleString('ko-KR')}</span>
                      {r.reporter_email && <span>· {r.reporter_email}</span>}
                      {r.reviewed_at && <span>· 검토: {new Date(r.reviewed_at).toLocaleString('ko-KR')}</span>}
                    </div>
                    {r.admin_note && (
                      <p className="mt-2 rounded bg-[#fafafa] p-2 text-xs text-[#484848]">📝 {r.admin_note}</p>
                    )}
                  </div>
                  {r.status === 'pending' && (
                    <ReportRowActions reportId={r.id} />
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
