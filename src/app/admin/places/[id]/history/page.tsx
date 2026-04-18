// T-055 — 업체별 감사 로그 타임라인
import { listAuditForPlace } from '@/lib/actions/audit-places'
import { summarizeAction, type AuditAction } from '@/lib/admin/audit'
import Link from 'next/link'

interface Params {
  params: Promise<{ id: string }>
}

export const dynamic = 'force-dynamic'

export default async function PlaceHistoryPage({ params }: Params) {
  const { id } = await params
  const entries = await listAuditForPlace(id, 100)

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">변경 이력</h1>
        <Link href="/admin/places" className="text-xs text-[#4c1d95] underline">← 목록으로</Link>
      </div>

      {entries.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[#dddddd] p-8 text-center text-sm text-[#6a6a6a]">
          아직 기록된 변경 이력이 없습니다.
        </p>
      ) : (
        <ol className="space-y-2">
          {entries.map(e => (
            <li key={e.id} className="rounded-lg border border-[#e5e7eb] bg-white p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium text-[#222222]">
                  {summarizeAction(e.action as AuditAction, {
                    field: e.field ?? undefined,
                    before: e.before_value,
                    after: e.after_value,
                  })}
                </span>
                <time className="text-xs text-[#6a6a6a]">{new Date(e.created_at).toLocaleString('ko-KR')}</time>
              </div>
              {(e.field || e.before_value !== null || e.after_value !== null) && (
                <div className="mt-1 text-xs text-[#484848]">
                  {e.field && <div>필드: <code className="rounded bg-[#f5f5f5] px-1">{e.field}</code></div>}
                  {e.before_value !== null && <div>이전: <code className="rounded bg-[#fef3c7] px-1">{JSON.stringify(e.before_value)}</code></div>}
                  {e.after_value !== null && <div>이후: <code className="rounded bg-[#d1fae5] px-1">{JSON.stringify(e.after_value)}</code></div>}
                  {e.reason && <div>사유: {e.reason}</div>}
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
