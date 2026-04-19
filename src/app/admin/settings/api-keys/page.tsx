// T-095 — /admin/settings/api-keys — 환경변수 존재·마스킹 상태.

import { requireAuth } from '@/lib/auth'
import { getApiKeyInfo, groupApiKeys } from '@/lib/admin/api-keys'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export default async function ApiKeysPage() {
  await requireAuth()
  const all = getApiKeyInfo()
  const { present, missing } = groupApiKeys(all)

  return (
    <div className="px-6 py-5">
      <header className="mb-5">
        <h1 className="text-xl font-semibold">API 키 관리</h1>
        <p className="mt-1 text-sm text-[#6b6b6b]">
          키 값은 <code className="rounded bg-[#f3f4f6] px-1 py-0.5 text-xs">.env.local</code> · Vercel 환경변수로만 관리됩니다.
          여기는 존재 여부·일부만 확인용.
        </p>
      </header>

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-semibold text-[#191919]">설정됨 ({present.length})</h2>
        <Table rows={present} />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-red-700">미설정 ({missing.length})</h2>
        {missing.length === 0 ? (
          <div className="rounded-xl border border-[#e7e7e7] bg-white p-6 text-sm text-[#6b6b6b]">모든 키가 설정되어 있습니다.</div>
        ) : (
          <Table rows={missing} />
        )}
      </section>
    </div>
  )
}

function Table({ rows }: { rows: ReturnType<typeof getApiKeyInfo> }) {
  if (rows.length === 0) return null
  return (
    <div className="overflow-hidden rounded-xl border border-[#e7e7e7] bg-white">
      <table className="w-full text-sm">
        <thead className="bg-[#fafafa] text-left text-xs uppercase tracking-wider text-[#6b6b6b]">
          <tr>
            <th className="px-4 py-3 font-medium">이름</th>
            <th className="px-4 py-3 font-medium">환경변수</th>
            <th className="px-4 py-3 font-medium">값</th>
            <th className="px-4 py-3 font-medium">용도</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#f0f0f0]">
          {rows.map(r => (
            <tr key={r.envVar}>
              <td className="px-4 py-2 text-[#191919]">{r.name}</td>
              <td className="px-4 py-2 font-mono text-xs text-[#6b6b6b]">{r.envVar}</td>
              <td className="px-4 py-2 font-mono text-xs">
                {r.masked ?? <span className="text-red-600">미설정</span>}
              </td>
              <td className="px-4 py-2 text-xs text-[#6b6b6b]">{r.usedBy}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
