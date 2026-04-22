// /owner/content tabs — 콘텐츠 유형 필터.
// 탭: 전체 / 업체 정보 / 비교 / 가이드 / 키워드 페이지 (5개).
// 모두 blog_posts.post_type 기반:
//   detail  = 특정 업체 심층 블로그글 (업체 정보)
//   compare = 업체 vs 업체 / guide = 선택 가이드 / keyword = 랜딩
// 업체 상세 URL 자체(place_mentions.page_type='place') 는 이 화면에서 제외 — /owner/places 소관.

import Link from 'next/link'
import type { ContentTabKey } from '@/lib/owner/content-mentions'

type FilterKey = ContentTabKey | 'all'

interface Props {
  active: FilterKey
  totalCount: number
  counts: Record<ContentTabKey, number>
}

const TAB_DEFS: Array<{ key: FilterKey; label: string }> = [
  { key: 'all',     label: '전체' },
  { key: 'detail',  label: '업체 정보' },
  { key: 'compare', label: '비교' },
  { key: 'guide',   label: '가이드' },
  { key: 'keyword', label: '키워드 페이지' },
]

export function ContentTabs({ active, totalCount, counts }: Props) {
  return (
    <div className="c-tabs" role="tablist" aria-label="콘텐츠 유형">
      {TAB_DEFS.map((t) => {
        const count = t.key === 'all' ? totalCount : counts[t.key as ContentTabKey]
        const disabled = t.key !== 'all' && count === 0
        const href = t.key === 'all' ? '/owner/content' : `/owner/content?type=${t.key}`
        const isActive = active === t.key
        return (
          <Link
            key={t.key}
            href={href}
            role="tab"
            aria-selected={isActive}
            aria-disabled={disabled || undefined}
            className={`${isActive ? 'active' : ''}${disabled ? ' disabled' : ''}`}
            tabIndex={disabled ? -1 : 0}
          >
            {t.label} <span className="ct">{count}</span>
          </Link>
        )
      })}
      <div className="sp" />
      <span className="sort">정렬 · <b>최신순</b></span>
    </div>
  )
}
