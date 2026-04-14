import Link from 'next/link'
import type { ComparisonEntry } from '@/lib/types'

interface ComparisonTableProps {
  entries: ComparisonEntry[]
  city: string
  category: string
}

export function ComparisonTable({ entries, city, category }: ComparisonTableProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {entries.map(entry => (
        <div
          key={entry.placeSlug}
          className="bg-white rounded-[20px] p-6 border border-[#c1c1c1]"
          style={{ boxShadow: 'var(--shadow-card)' }}
        >
          <div className="flex items-center justify-between mb-3">
            <Link
              href={`/${city}/${category}/${entry.placeSlug}`}
              className="text-lg font-semibold text-[#222222] hover:text-[#00a67c] transition-colors"
            >
              {entry.placeName}
            </Link>
            {entry.rating && (
              <span className="text-sm font-medium text-[#6a6a6a]">
                ★ {entry.rating} ({entry.reviewCount})
              </span>
            )}
          </div>

          <p className="text-sm font-medium text-[#00a67c] mb-3">{entry.priceRange}</p>

          <div className="mb-3">
            <p className="text-xs font-medium text-[#6a6a6a] mb-1">치료 방법</p>
            <ul className="text-sm text-[#222222] space-y-0.5">
              {entry.methods.map(m => (
                <li key={m}>· {m}</li>
              ))}
            </ul>
          </div>

          <div className="flex flex-wrap gap-1.5 mb-3">
            {entry.specialties.map(s => (
              <span key={s} className="px-2.5 py-1 text-xs text-[#222222] border border-[#c1c1c1] rounded-md">
                {s}
              </span>
            ))}
          </div>

          {entry.pros.length > 0 && (
            <div className="mb-2">
              <p className="text-xs font-medium text-[#00a67c] mb-0.5">장점</p>
              <ul className="text-xs text-[#6a6a6a] space-y-0.5">
                {entry.pros.map(p => <li key={p}>+ {p}</li>)}
              </ul>
            </div>
          )}

          {entry.cons.length > 0 && (
            <div>
              <p className="text-xs font-medium text-[#6a6a6a] mb-0.5">참고</p>
              <ul className="text-xs text-[#6a6a6a] space-y-0.5">
                {entry.cons.map(c => <li key={c}>- {c}</li>)}
              </ul>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
