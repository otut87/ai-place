import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

export interface BreadcrumbItem {
  name: string
  url: string
}

/**
 * 사이트 공통 breadcrumb (T-010h, WO #12)
 *
 * 사용처:
 * - 업체 상세 (4단계, buildBusinessBreadcrumb)
 * - 블로그 글 상세 (5단계, buildBlogBreadcrumb)
 *
 * 마지막 항목은 현재 페이지로 표시 (aria-current="page", 링크 미생성).
 */
export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  if (items.length === 0) return null

  return (
    <nav aria-label="Breadcrumb" className="text-sm text-[#666]">
      <ol className="flex items-center gap-1.5 flex-wrap">
        {items.map((item, idx) => {
          const isLast = idx === items.length - 1
          const isUrlAbsolute = /^https?:\/\//.test(item.url)
          // baseUrl 포함 절대 URL 인 경우 path 만 추출 (Next Link 는 상대 경로 선호)
          const href = isUrlAbsolute ? new URL(item.url).pathname || '/' : item.url
          return (
            <li key={`${idx}-${item.url}`} className="flex items-center gap-1.5">
              {isLast ? (
                <span aria-current="page" className="text-[#1a1a1a] font-medium truncate max-w-[60vw]">
                  {item.name}
                </span>
              ) : (
                <Link
                  href={href}
                  className="hover:text-[#1a1a1a] hover:underline transition-colors"
                >
                  {item.name}
                </Link>
              )}
              {!isLast && <ChevronRight size={14} className="text-[#bbb]" aria-hidden="true" />}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
