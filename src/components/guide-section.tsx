import Link from 'next/link'
import type { GuideSection as GuideSectionType } from '@/lib/types'

interface GuideSectionProps {
  section: GuideSectionType
  citySlug?: string
  categorySlug?: string
}

export function GuideSection({ section, citySlug, categorySlug }: GuideSectionProps) {
  return (
    <section className="mb-10">
      <h2 className="text-xl font-bold text-[#222222] mb-3">{section.heading}</h2>
      <p className="text-base text-[#222222] leading-relaxed">{section.content}</p>
      {section.items && section.items.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {section.items.map(item => (
            <li key={item} className="text-sm text-[#6a6a6a] flex items-start gap-2">
              <span className="text-[#00a67c] mt-0.5">·</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
      {section.recommendedPlaces && section.recommendedPlaces.length > 0 && (
        <div className="mt-4 space-y-3">
          {section.recommendedPlaces.map(place => (
            <div key={place.slug} className="flex items-center justify-between p-3 bg-[#f2f2f2] rounded-lg">
              <div>
                <span className="text-sm font-medium text-[#222222]">{place.name}</span>
                <span className="ml-2 text-xs text-[#6a6a6a]">{place.reason}</span>
              </div>
              {citySlug && categorySlug && (
                <Link
                  href={`/${citySlug}/${categorySlug}/${place.slug}`}
                  className="text-xs font-medium text-[#008f6b] hover:underline shrink-0 ml-3"
                >
                  상세 보기 →
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
