'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Save, Eye, FileText, LinkIcon, Calendar } from 'lucide-react'
import { saveBlogPost, deleteBlogPost, type SaveBlogInput } from '@/lib/actions/blog-edit'
import { renderMarkdown } from '@/lib/admin/blog-editor'
import { getBlockChecklist } from '@/lib/blog/template'
import { Trash2, ExternalLink } from 'lucide-react'
import { useToast } from '@/components/admin/toast'
import { AdminLink } from '@/components/admin/admin-link'

interface PostData {
  slug: string
  title: string
  summary: string
  content: string
  city: string
  sector: string
  category: string | null
  status: string
  target_query: string | null
  tags: string[]
  published_at: string | null
  related_place_slugs: string[]
}

interface PlaceCandidate {
  slug: string
  name: string
  rating: number | null
  reviewCount: number | null
}

interface SuggestionRow {
  kind: 'place' | 'blog'
  slug: string
  label: string
  url: string
}

export function BlogEditorClient({
  post,
  suggestions,
  placeCandidates,
}: {
  post: PostData
  suggestions: SuggestionRow[]
  placeCandidates: PlaceCandidate[]
}) {
  const router = useRouter()
  const toast = useToast()
  const [pending, start] = useTransition()

  const [title, setTitle] = useState(post.title)
  const [summary, setSummary] = useState(post.summary)
  const [content, setContent] = useState(post.content)
  const [tags, setTags] = useState((post.tags ?? []).join(', '))
  const [targetQuery, setTargetQuery] = useState(post.target_query ?? '')
  const [status, setStatus] = useState<SaveBlogInput['status']>(post.status as SaveBlogInput['status'])
  const [publishedAt, setPublishedAt] = useState('')
  const [relatedPlaces, setRelatedPlaces] = useState<string[]>(post.related_place_slugs ?? [])

  function togglePlace(slug: string) {
    setRelatedPlaces(prev => prev.includes(slug) ? prev.filter(s => s !== slug) : [...prev, slug])
  }

  function save() {
    start(async () => {
      const r = await saveBlogPost({
        slug: post.slug,
        title, summary, content,
        category: post.category,
        status,
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
        targetQuery: targetQuery.trim() || null,
        publishedAt: publishedAt ? new Date(publishedAt).toISOString() : null,
        relatedPlaceSlugs: relatedPlaces,
      })
      if (r.success) { toast.success('저장됨'); router.refresh() }
      else toast.error(r.error ?? '저장 실패')
    })
  }

  function onDelete() {
    if (!window.confirm(`"${post.title}" 을(를) 영구 삭제합니다. 되돌릴 수 없습니다. 계속할까요?`)) return
    start(async () => {
      const r = await deleteBlogPost(post.slug)
      if (r.success) { toast.success('삭제됨'); router.push('/admin/blog') }
      else toast.error(r.error ?? '삭제 실패')
    })
  }

  const publicUrl = `/blog/${post.city}/${post.sector}/${post.slug}`
  const isPublic = status === 'active'

  function insertLink(sug: SuggestionRow) {
    const snippet = `[${sug.label}](${sug.url})`
    setContent(prev => prev + (prev.endsWith('\n') ? '' : '\n') + snippet + '\n')
    toast.info(`${sug.label} 링크 추가됨`)
  }

  // T-111: 7블록 체크리스트 (Admin 사이드바)
  const blockChecklist = getBlockChecklist(content, post.category ?? undefined)
  const blockPassed = blockChecklist.filter(b => b.status === 'ok').length

  return (
    <div className="flex h-[calc(100vh-3rem)] flex-col">
      {/* 상단 바 */}
      <div className="flex items-center justify-between border-b border-[#e7e7e7] bg-white px-5 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <AdminLink href="/admin/blog" className="text-sm text-[#6b6b6b] hover:underline">← 캘린더</AdminLink>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="제목"
            className="h-9 min-w-0 max-w-[400px] flex-1 truncate rounded border border-[#e7e7e7] bg-white px-3 text-sm font-semibold"
          />
          <input
            type="text"
            value={targetQuery}
            onChange={e => setTargetQuery(e.target.value)}
            placeholder="타깃 키워드 (SEO)"
            className="h-9 w-52 rounded border border-[#e7e7e7] bg-white px-3 text-xs"
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            value={status}
            onChange={e => setStatus(e.target.value as SaveBlogInput['status'])}
            className="h-9 rounded border border-[#e7e7e7] bg-white px-2 text-xs"
          >
            <option value="draft">초안</option>
            <option value="scheduled">예약</option>
            <option value="active">발행</option>
            <option value="archived">보관</option>
          </select>
          {status === 'scheduled' && (
            <input
              type="datetime-local"
              value={publishedAt}
              onChange={e => setPublishedAt(e.target.value)}
              className="h-9 rounded border border-[#e7e7e7] bg-white px-2 text-xs"
            />
          )}
          <button
            type="button"
            disabled={pending}
            onClick={save}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[#191919] px-3 text-sm text-white hover:bg-[#333] disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" />
            {pending ? '저장 중…' : '저장'}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={onDelete}
            className="inline-flex h-9 items-center gap-1 rounded-md border border-[#e7e7e7] bg-white px-2 text-xs text-[#c26a6a] hover:bg-[#fef2f2] disabled:opacity-50"
            title="삭제"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* 공개 URL 인디케이터 */}
      <div className="flex items-center gap-2 border-b border-[#f0f0f0] bg-[#fafafa] px-5 py-1.5 text-[11px]">
        <span className="text-[#6b6b6b]">공개 주소:</span>
        {isPublic ? (
          <a
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-mono text-[#00a67c] hover:underline"
          >
            {publicUrl}
            <ExternalLink className="h-3 w-3" />
          </a>
        ) : (
          <>
            <span className="font-mono text-[#9a9a9a]">{publicUrl}</span>
            <span className="rounded-sm bg-amber-100 px-1.5 text-[10px] text-amber-800">
              {status === 'draft' ? '초안 — 발행 전 비공개' : status === 'scheduled' ? '예약 — 발행 전 비공개' : '보관 — 비공개'}
            </span>
          </>
        )}
      </div>

      {/* 분할 뷰 */}
      <div className="flex min-h-0 flex-1">
        {/* 좌: 편집 */}
        <div className="flex min-w-0 flex-1 flex-col border-r border-[#e7e7e7]">
          <div className="border-b border-[#f0f0f0] px-5 py-2 text-xs text-[#6b6b6b] flex items-center gap-1">
            <FileText className="h-3 w-3" /> 마크다운
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-3 p-5">
            <input
              type="text"
              value={summary}
              onChange={e => setSummary(e.target.value)}
              placeholder="요약 (meta description)"
              className="h-9 w-full rounded border border-[#e7e7e7] bg-white px-3 text-sm"
            />
            <input
              type="text"
              value={tags}
              onChange={e => setTags(e.target.value)}
              placeholder="태그 (쉼표 구분)"
              className="h-9 w-full rounded border border-[#e7e7e7] bg-white px-3 text-sm"
            />
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="# 제목&#10;&#10;본문 마크다운…"
              className="min-h-0 flex-1 rounded border border-[#e7e7e7] bg-white p-3 font-mono text-sm"
            />
          </div>
        </div>

        {/* 우: 프리뷰 + 링크 추천 */}
        <div className="flex w-[420px] flex-col">
          <div className="border-b border-[#f0f0f0] px-5 py-2 text-xs text-[#6b6b6b] flex items-center gap-1">
            <Eye className="h-3 w-3" /> 프리뷰
          </div>
          <div className="flex-1 overflow-y-auto p-5">
            <article className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }} />
          </div>

          {/* T-131: 관련 업체 체크박스 */}
          <div className="border-t border-[#e7e7e7] bg-[#fafafa] p-4">
            <div className="mb-2 flex items-center gap-1 text-xs font-medium text-[#6b6b6b]">
              관련 업체 ({relatedPlaces.length}/{placeCandidates.length})
            </div>
            {placeCandidates.length === 0 ? (
              <p className="text-[11px] text-[#9a9a9a]">이 카테고리의 등록 업체가 없습니다.</p>
            ) : (
              <ul className="max-h-48 space-y-0.5 overflow-y-auto">
                {placeCandidates.map(p => {
                  const checked = relatedPlaces.includes(p.slug)
                  return (
                    <li key={p.slug}>
                      <label className="flex cursor-pointer items-start gap-1.5 rounded px-1 py-0.5 text-xs hover:bg-white">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => togglePlace(p.slug)}
                          className="mt-0.5"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium text-[#191919]">{p.name}</span>
                          <span className="text-[10px] text-[#6b6b6b]">
                            {p.rating ? `★ ${p.rating.toFixed(1)}` : '평점 없음'}
                            {p.reviewCount != null && ` · ${p.reviewCount}건`}
                          </span>
                        </span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {/* T-111: 7블록 체크리스트 */}
          <div className="border-t border-[#e7e7e7] bg-[#fafafa] p-4">
            <div className="mb-2 flex items-center gap-1 text-xs font-medium text-[#6b6b6b]">
              <FileText className="h-3 w-3" /> 7블록 체크리스트 ({blockPassed}/7)
            </div>
            <ul className="space-y-0.5">
              {blockChecklist.map(({ block, status }) => (
                <li key={block.id} className="flex items-center gap-1.5 text-xs">
                  <span
                    className={
                      status === 'ok' ? 'text-[#22aa77]' :
                      status === 'short' ? 'text-[#d4a84a]' :
                      'text-[#c26a6a]'
                    }
                    aria-label={status}
                  >
                    {status === 'ok' ? '●' : status === 'short' ? '◐' : '○'}
                  </span>
                  <span className="text-[#191919]">{block.title}</span>
                  {status !== 'ok' && (
                    <span className="text-[10px] text-[#9a9a9a]">
                      {status === 'missing' ? '미작성' : '본문 부족'}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div className="border-t border-[#e7e7e7] bg-[#fafafa] p-4">
            <div className="mb-2 flex items-center gap-1 text-xs font-medium text-[#6b6b6b]">
              <LinkIcon className="h-3 w-3" /> 내부링크 후보 ({suggestions.length})
            </div>
            {suggestions.length === 0 ? (
              <p className="text-xs text-[#9a9a9a]">추천 가능한 내부링크가 없습니다.</p>
            ) : (
              <ul className="space-y-1">
                {suggestions.map(s => (
                  <li key={`${s.kind}:${s.slug}`}>
                    <button
                      type="button"
                      onClick={() => insertLink(s)}
                      className="block w-full truncate rounded px-2 py-1 text-left text-xs text-[#191919] hover:bg-white"
                      title={s.url}
                    >
                      <span className="mr-1 inline-block rounded-sm bg-white px-1 text-[10px] text-[#6b6b6b]">{s.kind}</span>
                      {s.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex items-center gap-1 border-t border-[#e7e7e7] bg-[#fafafa] px-4 py-2 text-[10px] text-[#9a9a9a]">
            <Calendar className="h-3 w-3" /> status: {status}
          </div>
        </div>
      </div>
    </div>
  )
}
