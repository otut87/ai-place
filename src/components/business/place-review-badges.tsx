import type { Place } from "@/lib/types"

// Phase 11 — medicalkoreaguide 벤치마크.
// 업체에 소스별 리뷰수/평점이 있을 때만 배지를 노출.
// Google 은 Places API 로 자동, Kakao 는 크롤러로 수집 (수동 입력 금지).
// T-233: 네이버 리뷰는 공개 노출 금지 정책 — Naver 배지 제거.

export interface PlaceReviewBadgesSource {
  googleRating?: number
  googleReviewCount?: number
  kakaoRating?: number
  kakaoReviewCount?: number
  // Fallback: 기존 rating/reviewCount (Google 기반) — 전용 필드 없을 때만 사용
  fallbackRating?: number
  fallbackReviewCount?: number
}

function formatCount(n: number): string {
  if (n >= 10000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`
  return n.toLocaleString('ko-KR')
}

/** 소스별 평점 + 리뷰수 배지. 데이터 있을 때만 렌더. */
export function PlaceReviewBadges({
  place,
  size = "sm",
  className,
}: {
  place: PlaceReviewBadgesSource | Place
  size?: "sm" | "md"
  className?: string
}) {
  const source: PlaceReviewBadgesSource = {
    googleRating: (place as Place).googleRating ?? (place as PlaceReviewBadgesSource).googleRating,
    googleReviewCount:
      (place as Place).googleReviewCount ?? (place as PlaceReviewBadgesSource).googleReviewCount,
    kakaoRating: (place as Place).kakaoRating ?? (place as PlaceReviewBadgesSource).kakaoRating,
    kakaoReviewCount:
      (place as Place).kakaoReviewCount ?? (place as PlaceReviewBadgesSource).kakaoReviewCount,
    fallbackRating: (place as Place).rating ?? (place as PlaceReviewBadgesSource).fallbackRating,
    fallbackReviewCount:
      (place as Place).reviewCount ?? (place as PlaceReviewBadgesSource).fallbackReviewCount,
  }

  const googleRating = source.googleRating ?? source.fallbackRating
  const googleCount = source.googleReviewCount ?? source.fallbackReviewCount

  const badges: Array<{ key: string; label: string; value: string; tone: "yellow" | "blue" }> = []

  if (googleCount != null && googleCount > 0) {
    const label = googleRating != null
      ? `Google ${googleRating.toFixed(1)} (${formatCount(googleCount)})`
      : `Google ${formatCount(googleCount)}`
    badges.push({ key: "google", label: "Google", value: label, tone: "blue" })
  }
  if (source.kakaoReviewCount != null && source.kakaoReviewCount > 0) {
    const label = source.kakaoRating != null
      ? `Kakao ${source.kakaoRating.toFixed(1)} (${formatCount(source.kakaoReviewCount)})`
      : `Kakao ${formatCount(source.kakaoReviewCount)}`
    badges.push({ key: "kakao", label: "Kakao", value: label, tone: "yellow" })
  } else if (source.kakaoRating != null) {
    badges.push({
      key: "kakao",
      label: "Kakao",
      value: `Kakao ${source.kakaoRating.toFixed(1)}`,
      tone: "yellow",
    })
  }

  if (badges.length === 0) return null

  const padding = size === "md" ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-[11px]"
  const tones: Record<string, string> = {
    yellow: "bg-[#fff7e6] text-[#a16207] border-[#a16207]/20",
    blue: "bg-[#e6f0ff] text-[#1d4ed8] border-[#1d4ed8]/20",
  }

  return (
    <ul
      className={["flex flex-wrap gap-1.5", className].filter(Boolean).join(" ")}
      aria-label="업체 평점/리뷰 수 요약"
    >
      {badges.map(b => (
        <li
          key={b.key}
          className={["inline-flex items-center font-medium border rounded-full", padding, tones[b.tone]].join(" ")}
        >
          {b.value}
        </li>
      ))}
    </ul>
  )
}
