'use client'

// T-128 — 블로그 캘린더 "+ 새 토픽" 버튼 + 인라인 모달.

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { createBlogTopic } from '@/lib/actions/blog-edit'
import { useToast } from '@/components/admin/toast'

interface Option {
  value: string
  label: string
}

interface Props {
  cities: Option[]
  sectors: Option[]
  categories: Array<Option & { sector: string }>
  /** 날짜 셀에서 바로 생성할 때 전달되는 YYYY-MM-DD */
  initialDate?: string | null
  /** 날짜 셀 인라인 모드(아이콘만 노출). 기본 false 는 헤더 "+ 새 토픽" 큰 버튼. */
  compact?: boolean
}

export function CreateTopicButton({ cities, sectors, categories, initialDate = null, compact = false }: Props) {
  const router = useRouter()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()

  const [title, setTitle] = useState('')
  const [city, setCity] = useState(cities[0]?.value ?? 'cheonan')
  const [sector, setSector] = useState(sectors[0]?.value ?? 'medical')
  const [category, setCategory] = useState('')
  // 파이프라인 post_type 과 동일한 4종.
  const [postType, setPostType] = useState<'detail' | 'compare' | 'guide' | 'keyword'>('detail')
  const [scheduledDate, setScheduledDate] = useState(initialDate ?? '')

  const filteredCategories = categories.filter(c => c.sector === sector)

  function submit() {
    if (!title.trim()) {
      toast.error('제목을 입력해 주세요')
      return
    }
    start(async () => {
      const r = await createBlogTopic({
        title,
        city,
        sector,
        category: category || null,
        postType,
        scheduledDate: scheduledDate || null,
      })
      if (r.success) {
        toast.success('토픽 생성됨 — 에디터로 이동')
        setOpen(false)
        router.push(`/admin/blog/${r.slug}/edit`)
      } else {
        toast.error(r.error)
      }
    })
  }

  return (
    <>
      {compact ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-4 w-4 items-center justify-center rounded-sm text-[#bdbdbd] hover:bg-[#f3f4f6] hover:text-[#191919]"
          title="이 날짜에 토픽 추가"
          aria-label="토픽 추가"
        >
          <Plus className="h-3 w-3" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-8 items-center gap-1 rounded-md bg-[#191919] px-3 text-xs text-white hover:bg-[#333]"
        >
          <Plus className="h-3.5 w-3.5" />새 토픽
        </button>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-[420px] rounded-xl border border-[#e7e7e7] bg-white p-5 shadow-lg"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="mb-4 text-base font-semibold">새 블로그 토픽</h2>

            <div className="space-y-3 text-sm">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-[#6b6b6b]">제목 *</span>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="예) 천안 피부과 여드름 치료 추천 3곳"
                  className="h-9 w-full rounded border border-[#e7e7e7] bg-white px-3 text-sm"
                  autoFocus
                />
              </label>

              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-[#6b6b6b]">도시 *</span>
                  <select
                    value={city}
                    onChange={e => setCity(e.target.value)}
                    className="h-9 w-full rounded border border-[#e7e7e7] bg-white px-2 text-sm"
                  >
                    {cities.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-[#6b6b6b]">섹터 *</span>
                  <select
                    value={sector}
                    onChange={e => {
                      setSector(e.target.value)
                      setCategory('')
                    }}
                    className="h-9 w-full rounded border border-[#e7e7e7] bg-white px-2 text-sm"
                  >
                    {sectors.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </label>
              </div>

              <label className="block">
                <span className="mb-1 block text-xs font-medium text-[#6b6b6b]">카테고리 (선택)</span>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="h-9 w-full rounded border border-[#e7e7e7] bg-white px-2 text-sm"
                >
                  <option value="">— 선택 안 함 —</option>
                  {filteredCategories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </label>

              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-[#6b6b6b]">글 유형</span>
                  <select
                    value={postType}
                    onChange={e => setPostType(e.target.value as typeof postType)}
                    className="h-9 w-full rounded border border-[#e7e7e7] bg-white px-2 text-sm"
                  >
                    <option value="detail">업체 정보</option>
                    <option value="compare">비교</option>
                    <option value="guide">가이드</option>
                    <option value="keyword">키워드</option>
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-[#6b6b6b]">발행 예약일 (선택)</span>
                  <input
                    type="date"
                    value={scheduledDate}
                    onChange={e => setScheduledDate(e.target.value)}
                    className="h-9 w-full rounded border border-[#e7e7e7] bg-white px-2 text-sm"
                  />
                </label>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="h-9 rounded-md border border-[#e7e7e7] bg-white px-3 text-sm hover:bg-[#fafafa]"
              >
                취소
              </button>
              <button
                type="button"
                disabled={pending || !title.trim()}
                onClick={submit}
                className="h-9 rounded-md bg-[#191919] px-3 text-sm text-white hover:bg-[#333] disabled:opacity-50"
              >
                {pending ? '생성 중…' : '생성 + 편집'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
