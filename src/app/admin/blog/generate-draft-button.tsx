'use client'

// T-129 — "+ AI 초안 생성" 버튼 (city+category 입력 → Claude 호출 → draft 생성 → 에디터로 이동).

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles } from 'lucide-react'
import { generateBlogDraftAction } from '@/lib/actions/generate-blog-draft'
import { useToast } from '@/components/admin/toast'

interface Option { value: string; label: string }

interface Props {
  cities: Option[]
  sectors: Option[]
  categories: Array<Option & { sector: string }>
}

export function GenerateDraftButton({ cities, sectors, categories }: Props) {
  const router = useRouter()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()

  const [city, setCity] = useState(cities[0]?.value ?? 'cheonan')
  const [sector, setSector] = useState(sectors[0]?.value ?? 'medical')
  const [category, setCategory] = useState('')
  const [postType, setPostType] = useState<'keyword' | 'compare' | 'guide' | 'general'>('general')

  const filteredCategories = categories.filter(c => c.sector === sector)

  function submit() {
    start(async () => {
      const r = await generateBlogDraftAction({
        city,
        sector,
        category: category || null,
        postType,
      })
      if (r.success) {
        toast.success(`초안 생성 완료 — 품질 ${r.qualityScore}점, 후보 ${r.candidateCount}곳${r.sevenBlockPassed ? ', 7블록 통과' : ', 7블록 보완 필요'}`)
        setOpen(false)
        router.push(`/admin/blog/${r.slug}/edit`)
      } else {
        toast.error(r.error)
      }
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={pending}
        className="inline-flex h-8 items-center gap-1 rounded-md border border-[#008f6b] bg-[#00a67c] px-3 text-xs text-white hover:bg-[#008f6b] disabled:opacity-50"
        title="LLM 이 도시·업종의 상위 업체를 선정하고 7블록 초안을 작성합니다"
      >
        <Sparkles className="h-3.5 w-3.5" />
        AI 초안 생성
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
          onClick={() => !pending && setOpen(false)}
        >
          <div
            className="w-[440px] rounded-xl border border-[#e7e7e7] bg-white p-5 shadow-lg"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="mb-1 text-base font-semibold">AI 블로그 초안 자동 생성</h2>
            <p className="mb-4 text-xs text-[#6b6b6b]">
              도시·업종을 선택하면 Claude Sonnet 가 상위 업체 3~5곳을 자동 선정하고 7블록 마크다운 초안을 작성합니다. 생성 후 에디터에서 검수·발행합니다.
            </p>

            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-[#6b6b6b]">도시 *</span>
                  <select value={city} onChange={e => setCity(e.target.value)} className="h-9 w-full rounded border border-[#e7e7e7] bg-white px-2 text-sm">
                    {cities.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-[#6b6b6b]">섹터 *</span>
                  <select value={sector} onChange={e => { setSector(e.target.value); setCategory('') }} className="h-9 w-full rounded border border-[#e7e7e7] bg-white px-2 text-sm">
                    {sectors.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </label>
              </div>

              <label className="block">
                <span className="mb-1 block text-xs font-medium text-[#6b6b6b]">카테고리 *</span>
                <select value={category} onChange={e => setCategory(e.target.value)} className="h-9 w-full rounded border border-[#e7e7e7] bg-white px-2 text-sm">
                  <option value="">— 섹터의 첫 카테고리 자동 선택 —</option>
                  {filteredCategories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-medium text-[#6b6b6b]">글 유형</span>
                <select value={postType} onChange={e => setPostType(e.target.value as typeof postType)} className="h-9 w-full rounded border border-[#e7e7e7] bg-white px-2 text-sm">
                  <option value="general">일반 추천·분석</option>
                  <option value="keyword">키워드 랜딩</option>
                  <option value="compare">비교</option>
                  <option value="guide">선택 가이드</option>
                </select>
              </label>

              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                <strong>예상 비용:</strong> Claude Sonnet 4.6 기준 건당 약 $0.03~0.08 (입력 2K~4K + 출력 4K~6K 토큰).
                <br/>
                <strong>소요 시간:</strong> 30초~2분. 완료 후 자동으로 에디터로 이동합니다.
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} disabled={pending} className="h-9 rounded-md border border-[#e7e7e7] bg-white px-3 text-sm hover:bg-[#fafafa] disabled:opacity-50">
                취소
              </button>
              <button type="button" disabled={pending} onClick={submit} className="inline-flex h-9 items-center gap-1 rounded-md bg-[#00a67c] px-3 text-sm text-white hover:bg-[#008f6b] disabled:opacity-50">
                <Sparkles className="h-3.5 w-3.5" />
                {pending ? '생성 중 (~1분)…' : '초안 생성'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
