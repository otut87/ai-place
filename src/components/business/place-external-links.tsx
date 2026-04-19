import type { Place } from "@/lib/types"

// Phase 11 — medicalkoreaguide 벤치마크.
// 업체의 외부 플랫폼 링크 6종을 일관된 컴팩트 버튼으로 노출.
// 데이터 없는 슬롯은 렌더하지 않는다 ("있으면 넣는다" 원칙).

export interface PlaceExternalLinksSource {
  naverPlaceUrl?: string
  kakaoMapUrl?: string
  googleBusinessUrl?: string
  homepageUrl?: string
  blogUrl?: string
  instagramUrl?: string
}

type Variant = "inline" | "buttons"

interface Slot {
  key: string
  label: string
  href: string
  aria: string
}

function buildSlots(src: PlaceExternalLinksSource): Slot[] {
  const slots: Slot[] = []
  if (src.naverPlaceUrl) slots.push({ key: "naver", label: "Naver Place", href: src.naverPlaceUrl, aria: "네이버 플레이스에서 보기" })
  if (src.kakaoMapUrl) slots.push({ key: "kakao", label: "KakaoMap", href: src.kakaoMapUrl, aria: "카카오맵에서 보기" })
  if (src.googleBusinessUrl) slots.push({ key: "google", label: "Google Maps", href: src.googleBusinessUrl, aria: "구글 지도에서 보기" })
  if (src.homepageUrl) slots.push({ key: "homepage", label: "홈페이지", href: src.homepageUrl, aria: "공식 홈페이지 방문" })
  if (src.blogUrl) slots.push({ key: "blog", label: "블로그", href: src.blogUrl, aria: "블로그 방문" })
  if (src.instagramUrl) slots.push({ key: "instagram", label: "Instagram", href: src.instagramUrl, aria: "Instagram 방문" })
  return slots
}

/** 업체 외부 링크 버튼 그룹. 데이터가 있는 슬롯만 출력. */
export function PlaceExternalLinks({
  place,
  variant = "buttons",
  className,
}: {
  place: PlaceExternalLinksSource | Place
  variant?: Variant
  className?: string
}) {
  const src: PlaceExternalLinksSource = {
    naverPlaceUrl: (place as Place).naverPlaceUrl ?? (place as PlaceExternalLinksSource).naverPlaceUrl,
    kakaoMapUrl: (place as Place).kakaoMapUrl ?? (place as PlaceExternalLinksSource).kakaoMapUrl,
    googleBusinessUrl: (place as Place).googleBusinessUrl ?? (place as PlaceExternalLinksSource).googleBusinessUrl,
    homepageUrl: (place as Place).homepageUrl ?? (place as PlaceExternalLinksSource).homepageUrl,
    blogUrl: (place as Place).blogUrl ?? (place as PlaceExternalLinksSource).blogUrl,
    instagramUrl: (place as Place).instagramUrl ?? (place as PlaceExternalLinksSource).instagramUrl,
  }

  const slots = buildSlots(src)
  if (slots.length === 0) return null

  if (variant === "inline") {
    return (
      <ul
        className={["flex flex-wrap gap-x-3 gap-y-1 text-xs text-[#1d4ed8]", className].filter(Boolean).join(" ")}
        aria-label="업체 외부 링크"
      >
        {slots.map(s => (
          <li key={s.key}>
            <a
              href={s.href}
              target="_blank"
              rel="noopener noreferrer nofollow"
              aria-label={s.aria}
              className="hover:underline"
            >
              {s.label}
            </a>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <ul
      className={["flex flex-wrap gap-2", className].filter(Boolean).join(" ")}
      aria-label="업체 외부 링크"
    >
      {slots.map(s => (
        <li key={s.key}>
          <a
            href={s.href}
            target="_blank"
            rel="noopener noreferrer nofollow"
            aria-label={s.aria}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#222222] bg-white border border-[#c1c1c1] rounded-full hover:bg-[#f2f2f2] transition-colors"
          >
            {s.label}
          </a>
        </li>
      ))}
    </ul>
  )
}
