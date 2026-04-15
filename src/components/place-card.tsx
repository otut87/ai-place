import Link from "next/link"
import Image from "next/image"
import type { Place } from "@/lib/types"

export function PlaceCard({ place }: { place: Place }) {
  return (
    <Link
      href={`/${place.city}/${place.category}/${place.slug}`}
      className="group block"
    >
      <article className="rounded-[20px] overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
        {/* Image */}
        <div className="aspect-[16/10] bg-[#f2f2f2] relative overflow-hidden">
          {place.imageUrl ? (
            <Image
              src={place.imageUrl}
              alt={place.name}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#c1c1c1" strokeWidth="1.5">
                <path d="M19 21V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v16m14 0H5m14 0h2m-16 0H3" />
                <path d="M9 7h1m-1 4h1m4-4h1m-1 4h1" />
              </svg>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-5">
          {/* Name + Rating */}
          <h3 className="text-[22px] font-semibold text-[#222222] leading-tight tracking-[-0.44px]">
            {place.name}
          </h3>
          {place.rating != null && (
            <div className="mt-1 flex items-center gap-1">
              <span className="text-xs font-medium text-[#222222]">★ {place.rating}</span>
              {place.reviewCount != null && (
                <span className="text-xs text-[#6a6a6a]">· Google 리뷰 {place.reviewCount}건</span>
              )}
            </div>
          )}

          {/* Address */}
          <p className="mt-2 text-sm text-[#6a6a6a] leading-relaxed line-clamp-1">
            {place.address}
          </p>

          {/* Tags */}
          {place.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {place.tags.slice(0, 4).map(tag => (
                <span
                  key={tag}
                  className="px-2 py-0.5 text-[11px] text-[#6a6a6a] border border-[#e0e0e0] rounded-full"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </article>
    </Link>
  )
}
