'use client'

// T-129 / T-135 — "AI 초안 생성" 버튼 + 모달.
// 도시·카테고리 선택 후 업체 리스트를 조회, 자동 필터 or 수동 선택 가능.

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles } from 'lucide-react'
import {
  generateBlogDraftAction,
  listPlacesForCategoryAction,
  type PlaceCandidateListing,
} from '@/lib/actions/generate-blog-draft'
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

  const [mode, setMode] = useState<'auto' | 'manual'>('auto')
  const [minRating, setMinRating] = useState('4.0')
  const [minReviewCount, setMinReviewCount] = useState('10')
  const [maxCount, setMaxCount] = useState('5')

  const [places, setPlaces] = useState<PlaceCandidateListing[]>([])
  const [placesLoading, setPlacesLoading] = useState(false)
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>([])

  const filteredCategories = categories.filter(c => c.sector === sector)
  const effectiveCategory = category || filteredCategories[0]?.value

  // city/category 변경 시 업체 목록 조회
  useEffect(() => {
    if (!open || !effectiveCategory) return
    let cancelled = false
    setPlacesLoading(true)
    listPlacesForCategoryAction(city, effectiveCategory)
      .then(rows => {
        if (cancelled) return
        setPlaces(rows)
        // 자동 모드: 기본 임계값 통과 상위 maxCount 를 프리뷰 체크
        const autoSelected = rows
          .filter(p => (p.rating ?? 0) >= parseFloat(minRating || '0') && (p.reviewCount ?? 0) >= parseInt(minReviewCount || '0'))
          .slice(0, parseInt(maxCount || '5'))
          .map(p => p.slug)
        setSelectedSlugs(autoSelected)
      })
      .finally(() => {
        if (!cancelled) setPlacesLoading(false)
      })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city, effectiveCategory, open])

  function toggleSlug(slug: string) {
    setSelectedSlugs(prev => prev.includes(slug) ? prev.filter(s => s !== slug) : [...prev, slug])
  }

  function submit() {
    const minR = parseFloat(minRating) || 0
    const minRC = parseInt(minReviewCount) || 0
    const maxC = parseInt(maxCount) || 5

    if (mode === 'manual' && selectedSlugs.length === 0) {
      toast.error('수동 모드: 업체를 1개 이상 선택하세요')
      return
    }

    start(async () => {
      const r = await generateBlogDraftAction({
        city,
        sector,
        category: category || null,
        postType,
        minRating: minR,
        minReviewCount: minRC,
        maxCount: maxC,
        manualPlaceSlugs: mode === 'manual' ? selectedSlugs : undefined,
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

  const autoPreviewCount = places.filter(
    p => (p.rating ?? 0) >= parseFloat(minRating || '0') && (p.reviewCount ?? 0) >= parseInt(minReviewCount || '0'),
  ).length

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={pending}
        className="inline-flex h-8 items-center gap-1 rounded-md border border-[#008f6b] bg-[#00a67c] px-3 text-xs text-white hover:bg-[#008f6b] disabled:opacity-50"
        title="LLM 이 업체를 선정하고 7블록 초안을 작성합니다"
      >
        <Sparkles className="h-3.5 w-3.5" />
        AI 초안 생성
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          onClick={() => !pending && setOpen(false)}
        >
          <div
            className="flex max-h-[90vh] w-[560px] flex-col rounded-xl border border-[#e7e7e7] bg-white shadow-lg"
            onClick={e => e.stopPropagation()}
          >
            <div className="border-b border-[#f0f0f0] p-5">
              <h2 className="text-base font-semibold">AI 블로그 초안 자동 생성</h2>
              <p className="mt-1 text-xs text-[#6b6b6b]">
                도시·업종을 선택하고 후보 업체를 확인·조정한 뒤 생성하세요. 7블록 마크다운 초안이 에디터에 자동 로드됩니다.
              </p>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5 text-sm">
              {/* 기본 정보 */}
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

              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-[#6b6b6b]">카테고리 *</span>
                  <select value={category} onChange={e => setCategory(e.target.value)} className="h-9 w-full rounded border border-[#e7e7e7] bg-white px-2 text-sm">
                    <option value="">— 섹터 첫 카테고리 —</option>
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
              </div>

              {/* 선정 모드 탭 */}
              <div className="border-t border-[#f0f0f0] pt-3">
                <div className="flex gap-1 rounded-md bg-[#fafafa] p-1">
                  <button
                    type="button"
                    onClick={() => setMode('auto')}
                    className={`flex-1 rounded px-2 py-1.5 text-xs ${mode === 'auto' ? 'bg-white font-semibold shadow-sm' : 'text-[#6b6b6b]'}`}
                  >
                    자동 선정
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('manual')}
                    className={`flex-1 rounded px-2 py-1.5 text-xs ${mode === 'manual' ? 'bg-white font-semibold shadow-sm' : 'text-[#6b6b6b]'}`}
                  >
                    수동 선택 ({selectedSlugs.length})
                  </button>
                </div>

                {mode === 'auto' ? (
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-[#6b6b6b]">최소 평점</span>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="5"
                        value={minRating}
                        onChange={e => setMinRating(e.target.value)}
                        className="h-9 w-full rounded border border-[#e7e7e7] bg-white px-2 text-sm"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-[#6b6b6b]">최소 리뷰</span>
                      <input
                        type="number"
                        min="0"
                        value={minReviewCount}
                        onChange={e => setMinReviewCount(e.target.value)}
                        className="h-9 w-full rounded border border-[#e7e7e7] bg-white px-2 text-sm"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-[#6b6b6b]">최대 업체 수</span>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={maxCount}
                        onChange={e => setMaxCount(e.target.value)}
                        className="h-9 w-full rounded border border-[#e7e7e7] bg-white px-2 text-sm"
                      />
                    </label>
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-[#6b6b6b]">
                    아래 목록에서 글에 포함할 업체를 직접 체크하세요. 체크된 업체만 LLM 에 전달됩니다.
                  </p>
                )}
              </div>

              {/* 업체 목록 */}
              <div className="border-t border-[#f0f0f0] pt-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-[#6b6b6b]">
                    {city}/{effectiveCategory ?? '—'} 등록 업체
                    {' '}
                    ({placesLoading ? '…' : places.length}개)
                  </span>
                  {mode === 'auto' && (
                    <span className="text-[11px] text-[#6b6b6b]">
                      현재 기준 통과: <strong className={autoPreviewCount === 0 ? 'text-red-600' : 'text-emerald-700'}>{autoPreviewCount}곳</strong>
                    </span>
                  )}
                </div>

                {places.length === 0 && !placesLoading ? (
                  <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                    이 카테고리에 등록된 업체가 없습니다. /admin/register 에서 먼저 업체를 등록해 주세요.
                  </p>
                ) : (
                  <ul className="max-h-56 space-y-0.5 overflow-y-auto rounded-md border border-[#e7e7e7] bg-white">
                    {places.map(p => {
                      const passesAuto =
                        (p.rating ?? 0) >= parseFloat(minRating || '0') &&
                        (p.reviewCount ?? 0) >= parseInt(minReviewCount || '0')
                      const checked = selectedSlugs.includes(p.slug)
                      return (
                        <li key={p.slug} className="border-b border-[#f5f5f5] last:border-b-0">
                          <label className="flex cursor-pointer items-start gap-2 px-3 py-2 text-xs hover:bg-[#fafafa]">
                            <input
                              type="checkbox"
                              checked={mode === 'manual' ? checked : passesAuto}
                              disabled={mode === 'auto'}
                              onChange={() => mode === 'manual' && toggleSlug(p.slug)}
                              className="mt-0.5"
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block font-medium text-[#191919]">{p.name}</span>
                              <span className="text-[10px] text-[#6b6b6b]">
                                {p.rating != null ? `★ ${p.rating.toFixed(1)}` : '평점 없음'}
                                {p.reviewCount != null && ` · 리뷰 ${p.reviewCount}건`}
                                {mode === 'auto' && !passesAuto && <span className="ml-1 text-amber-700">(기준 미달)</span>}
                              </span>
                            </span>
                          </label>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>

              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                <strong>비용:</strong> Claude Sonnet 4.6 기준 건당 $0.03~0.08.
                <strong className="ml-2">소요:</strong> 30초~2분.
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-[#f0f0f0] p-4">
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
