import Link from 'next/link'
import { buildPageList } from '@/lib/admin/places-query'

interface Props {
  currentPage: number
  totalPages: number
  baseParams: URLSearchParams
}

function hrefFor(page: number, baseParams: URLSearchParams): string {
  const p = new URLSearchParams(baseParams)
  if (page <= 1) p.delete('page')
  else p.set('page', String(page))
  const qs = p.toString()
  return `/admin/places${qs ? `?${qs}` : ''}`
}

export function PlacesPagination({ currentPage, totalPages, baseParams }: Props) {
  if (totalPages <= 1) return null
  const items = buildPageList(currentPage, totalPages, 5)

  const baseBtn =
    'h-9 min-w-9 px-3 inline-flex items-center justify-center rounded-lg border text-sm'
  const inactive = 'border-[#dddddd] bg-white text-[#222222] hover:border-[#222222]'
  const active = 'border-[#222222] bg-[#222222] text-white'
  const disabled = 'border-[#eeeeee] bg-[#f7f7f7] text-[#bbbbbb] pointer-events-none'

  const prevPage = Math.max(1, currentPage - 1)
  const nextPage = Math.min(totalPages, currentPage + 1)

  return (
    <nav className="mt-8 flex items-center justify-center gap-1" aria-label="페이지네이션">
      <Link
        href={hrefFor(prevPage, baseParams)}
        className={`${baseBtn} ${currentPage === 1 ? disabled : inactive}`}
        aria-disabled={currentPage === 1}
      >
        이전
      </Link>

      {items.map((item, idx) =>
        item === 'ellipsis' ? (
          <span key={`e-${idx}`} className="px-2 text-[#6a6a6a]">
            …
          </span>
        ) : (
          <Link
            key={item}
            href={hrefFor(item, baseParams)}
            aria-current={item === currentPage ? 'page' : undefined}
            className={`${baseBtn} ${item === currentPage ? active : inactive}`}
          >
            {item}
          </Link>
        ),
      )}

      <Link
        href={hrefFor(nextPage, baseParams)}
        className={`${baseBtn} ${currentPage === totalPages ? disabled : inactive}`}
        aria-disabled={currentPage === totalPages}
      >
        다음
      </Link>
    </nav>
  )
}
