// T-077 + T-084 — /admin/prompts — 카테고리별 프롬프트 버전 + A/B 집계.

import { requireAuth } from '@/lib/auth'
import { cachedCategories } from '@/lib/admin/cached-data'
import {
  listPromptTemplates,
  getPromptAggregates,
  type PromptTemplateRow,
  type PromptAggregate,
} from '@/lib/admin/prompt-templates'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default async function AdminPromptsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireAuth()
  const raw = await searchParams
  const cat = Array.isArray(raw.cat) ? raw.cat[0] : raw.cat

  const categories = await cachedCategories()
  const selected = cat && categories.some(c => c.slug === cat) ? cat : categories[0]?.slug

  const [templates, agg] = selected
    ? await Promise.all([listPromptTemplates(selected), getPromptAggregates(selected)])
    : [[] as PromptTemplateRow[], [] as PromptAggregate[]]

  const aggMap = new Map(agg.map(a => [a.promptTemplateId, a]))

  return (
    <div className="px-6 py-5">
      <header className="mb-5">
        <h1 className="text-xl font-semibold">프롬프트 템플릿 · A/B</h1>
        <p className="mt-1 text-sm text-[#6b6b6b]">
          카테고리별 시스템/유저 프롬프트 버전. 버전 활성화 시 새 생성 요청에 적용.
        </p>
      </header>

      <form method="get" className="mb-4">
        <select name="cat" defaultValue={selected ?? ''} className="h-10 rounded-md border border-[#e7e7e7] bg-white px-3 text-sm">
          {categories.map(c => (
            <option key={c.slug} value={c.slug}>{c.name}</option>
          ))}
        </select>
        <button type="submit" className="ml-2 h-10 rounded-md bg-[#191919] px-3 text-sm text-white">조회</button>
      </form>

      {templates.length === 0 ? (
        <div className="rounded-xl border border-[#e7e7e7] bg-white p-10 text-center text-sm text-[#6b6b6b]">
          이 카테고리의 템플릿이 아직 없습니다.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[#e7e7e7] bg-white">
          <table className="w-full text-sm">
            <thead className="bg-[#fafafa] text-left text-xs uppercase tracking-wider text-[#6b6b6b]">
              <tr>
                <th className="px-4 py-3 font-medium">버전</th>
                <th className="px-4 py-3 font-medium">활성</th>
                <th className="px-4 py-3 font-medium">호출 수</th>
                <th className="px-4 py-3 font-medium">평균 점수</th>
                <th className="px-4 py-3 font-medium">통과율 (≥70)</th>
                <th className="px-4 py-3 font-medium">생성일</th>
                <th className="px-4 py-3 font-medium">메모</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f0f0]">
              {templates.map(t => {
                const a = aggMap.get(t.id)
                return (
                  <tr key={t.id}>
                    <td className="px-4 py-3 font-medium text-[#191919]">v{t.version}</td>
                    <td className="px-4 py-3">
                      {t.active ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">활성</span> : <span className="text-xs text-[#6b6b6b]">—</span>}
                    </td>
                    <td className="px-4 py-3">{a?.calls ?? 0}</td>
                    <td className="px-4 py-3">{a ? a.avgScore.toFixed(1) : '—'}</td>
                    <td className="px-4 py-3">{a ? `${Math.round(a.passRate * 100)}%` : '—'}</td>
                    <td className="px-4 py-3 text-xs text-[#6b6b6b]">{new Date(t.created_at).toLocaleDateString('ko-KR')}</td>
                    <td className="px-4 py-3 text-xs text-[#6b6b6b]">{t.notes ?? '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
