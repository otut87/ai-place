import Link from "next/link"
import Image from "next/image"
import type { Place } from "@/lib/types"
import { formatRatingLine } from "@/lib/format/rating"
import { PlaceReviewBadges } from "@/components/business/place-review-badges"

// T-098: 사진 없는 업체 플레이스홀더 — 회색 아이콘 대신 업체명 첫 글자로 정돈.
// 철학 10% UI 비중 내 최소 공수. 복잡한 일러스트/애니메이션 금지.
export function PlaceCard({ place }: { place: Place }) {
  return (
    <Link
      href={`/${place.city}/${place.category}/${place.slug}`}
      className="group block"
    >
      <article className="rounded-[20px] overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
        {/* Image or initial-letter placeholder */}
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
            <div
              aria-hidden="true"
              className="w-full h-full flex items-center justify-center bg-[#ececec] text-[#8a8a8a] text-3xl font-semibold select-none"
            >
              {place.name.trim().slice(0, 1)}
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
              <span className="text-xs font-medium text-[#222222]">
                {formatRatingLine(place.rating, place.reviewCount ?? 0, 'google')}
              </span>
            </div>
          )}

          {/* Phase 11: Naver/Kakao 리뷰 배지 — 크롤러가 채운 수치만 노출 (Google 은 상단 평점과 중복) */}
          {(place.naverReviewCount || place.kakaoRating != null || place.kakaoReviewCount) && (
            <PlaceReviewBadges
              className="mt-2"
              place={{
                naverReviewCount: place.naverReviewCount,
                kakaoRating: place.kakaoRating,
                kakaoReviewCount: place.kakaoReviewCount,
              }}
            />
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
