import type { ReviewSummary } from "@/lib/types"

// Phase 11 — 리뷰 요약 섹션.
// 원본 리뷰를 그대로 표시하는 대신, 소스별(Google/Naver/Kakao) AI 요약 1건만 노출.
// 저작권/ToS 회피 + LLM 인용에 유리한 구조화 포맷.

interface Props {
  summaries: ReviewSummary[]
  businessName: string
  className?: string
}

const SOURCE_LABELS: Record<string, string> = {
  google: 'Google',
  naver: 'Naver',
  kakao: 'Kakao',
}

function labelForSource(source: string): string {
  return SOURCE_LABELS[source.toLowerCase()] ?? source
}

function hasContent(s: ReviewSummary): boolean {
  return (s.positiveThemes.length > 0) || (s.negativeThemes.length > 0) || Boolean(s.sampleQuote)
}

export function PlaceReviewSummary({ summaries, businessName, className }: Props) {
  const shown = summaries.filter(hasContent)
  if (shown.length === 0) return null

  return (
    <section
      id="review-summary"
      className={["mt-12", className].filter(Boolean).join(" ")}
      aria-label="플랫폼별 리뷰 요약"
    >
      <h2 className="text-[20px] font-semibold text-[#222222] leading-[1.2] tracking-[-0.18px] mb-1">
        리뷰 요약
      </h2>
      <p className="text-sm text-[#222222] mb-4">
        {businessName}의 플랫폼별 고객 리뷰를 AI가 구조화 요약한 결과입니다.
        원문은 각 플랫폼에서 직접 확인하실 수 있습니다.
      </p>
      <div className="space-y-4">
        {shown.map(s => (
          <article
            key={s.source}
            className="p-5 bg-[#f2f2f2] rounded-[14px]"
          >
            <header className="flex items-center justify-between mb-3">
              <h3 className="text-[15px] font-semibold text-[#222222]">
                {labelForSource(s.source)} 리뷰 요약
              </h3>
              <time dateTime={s.lastChecked} className="text-[11px] text-[#6a6a6a]">
                {s.lastChecked} 기준
              </time>
            </header>

            {s.sampleQuote && (
              <blockquote className="text-sm text-[#222222] italic leading-relaxed mb-3 pl-3 border-l-2 border-[#008f6b]">
                {s.sampleQuote}
              </blockquote>
            )}

            {s.positiveThemes.length > 0 && (
              <div className="mb-2">
                <dt className="text-xs font-semibold text-[#008f6b] mb-1">긍정 테마</dt>
                <dd>
                  <ul className="flex flex-wrap gap-1.5">
                    {s.positiveThemes.map(t => (
                      <li
                        key={t}
                        className="px-2 py-0.5 text-[11px] text-[#008f6b] bg-[#e6f7f2] border border-[#008f6b]/20 rounded-full"
                      >
                        {t}
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
            )}

            {s.negativeThemes.length > 0 && (
              <div>
                <dt className="text-xs font-semibold text-[#a16207] mb-1">개선 희망 포인트</dt>
                <dd>
                  <ul className="flex flex-wrap gap-1.5">
                    {s.negativeThemes.map(t => (
                      <li
                        key={t}
                        className="px-2 py-0.5 text-[11px] text-[#a16207] bg-[#fff7e6] border border-[#a16207]/20 rounded-full"
                      >
                        {t}
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
            )}
          </article>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-[#9a9a9a]">
        AI가 플랫폼별 공개 리뷰를 구조화 요약한 것으로, 원문 그대로의 인용이 아닙니다.
      </p>
    </section>
  )
}
