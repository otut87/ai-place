// Admin — 소유권 이관 문의 목록 + 승인/거절.
import { requireAuth } from '@/lib/auth'
import { getAdminClient } from '@/lib/supabase/admin-client'
import { ClaimRowActions } from './claim-row-actions'

export const dynamic = 'force-dynamic'

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  pending: { label: '대기', className: 'bg-[#fef3c7] text-[#92400e]' },
  approved: { label: '승인', className: 'bg-[#d1fae5] text-[#065f46]' },
  rejected: { label: '거절', className: 'bg-[#fee2e2] text-[#991b1b]' },
  withdrawn: { label: '철회', className: 'bg-[#f3f4f6] text-[#484848]' },
}

export default async function AdminClaimsPage() {
  await requireAuth()
  const admin = getAdminClient()
  if (!admin) return <div className="p-6 text-red-600">DB 연결 실패</div>

  const { data } = await admin
    .from('ownership_claims')
    .select(`
      id, place_id, claimant_email, current_owner_email, reason, evidence_url,
      contact_phone, status, admin_note, resolution_note, created_at, resolved_at,
      places:place_id(name, city, category, slug)
    `)
    .order('created_at', { ascending: false })
    .limit(100)

  const rows = ((data ?? []) as unknown as Array<{
    id: string; place_id: string; claimant_email: string | null
    current_owner_email: string | null; reason: string | null
    evidence_url: string | null; contact_phone: string | null
    status: string; admin_note: string | null; resolution_note: string | null
    created_at: string; resolved_at: string | null
    places: { name: string; city: string; category: string; slug: string } | null | Array<{ name: string; city: string; category: string; slug: string }>
  }>).map(c => ({
    ...c,
    places: Array.isArray(c.places) ? (c.places[0] ?? null) : c.places,
  }))

  return (
    <div className="mx-auto max-w-5xl p-6">
      <header className="mb-6">
        <h1 className="text-xl font-semibold">🔑 소유권 이관 문의 ({rows.length}건)</h1>
        <p className="mt-1 text-xs text-[#6a6a6a]">
          승인 시 해당 업체의 owner_id / owner_email / customer_id 가 claimant 로 자동 재할당됩니다. 전화 확인 후 승인 권장.
        </p>
      </header>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[#dddddd] p-8 text-center text-sm text-[#6a6a6a]">
          접수된 문의가 없습니다.
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map(c => {
            const st = STATUS_LABEL[c.status] ?? { label: c.status, className: 'bg-[#f3f4f6]' }
            return (
              <li key={c.id} className="rounded-lg border border-[#e5e7eb] bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] ${st.className}`}>{st.label}</span>
                      {c.places ? (
                        <a
                          href={`/${c.places.city}/${c.places.category}/${c.places.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-[#222222] hover:text-[#008060] underline"
                        >
                          {c.places.name}
                        </a>
                      ) : (
                        <span className="text-sm text-[#9a9a9a]">[삭제된 업체]</span>
                      )}
                    </div>

                    <div className="mt-2 grid gap-1 text-xs sm:grid-cols-2">
                      <p><strong>클레임 신청자:</strong> {c.claimant_email ?? '-'}</p>
                      <p><strong>연락처:</strong> {c.contact_phone ?? '-'}</p>
                      <p className="sm:col-span-2"><strong>현재 소유자:</strong> {c.current_owner_email ?? '-'}</p>
                    </div>

                    {c.reason && (
                      <div className="mt-2 rounded bg-[#fafafa] p-2">
                        <p className="whitespace-pre-wrap text-xs text-[#484848]">{c.reason}</p>
                      </div>
                    )}

                    {c.evidence_url && (
                      <p className="mt-2 text-xs">
                        <strong>증빙:</strong>{' '}
                        <a href={c.evidence_url} target="_blank" rel="noopener noreferrer" className="text-[#008060] underline">
                          {c.evidence_url}
                        </a>
                      </p>
                    )}

                    <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-[#9a9a9a]">
                      <span>접수: {new Date(c.created_at).toLocaleString('ko-KR')}</span>
                      {c.resolved_at && <span>· 처리: {new Date(c.resolved_at).toLocaleString('ko-KR')}</span>}
                    </div>

                    {c.resolution_note && (
                      <p className="mt-2 rounded bg-[#fafafa] p-2 text-xs text-[#484848]">📝 {c.resolution_note}</p>
                    )}
                  </div>

                  {c.status === 'pending' && (
                    <ClaimRowActions claimId={c.id} />
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
