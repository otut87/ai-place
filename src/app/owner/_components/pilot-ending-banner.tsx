// T-226 — 파일럿 종료 D-3 / D-1 / D-0 예고 배너.
// 카드 선등록 모델 (T-223.5) 전제 — 카드 등록은 이미 완료되어 있음.
// "다음 주 X일 ₩{amount} 첫 결제 예정" + "자세히" / "해지" CTA 2개.

import Link from 'next/link'
import { PLAN_AMOUNT_PER_PLACE, calculatePlanAmount } from '@/lib/billing/types'

export interface PilotEndingBannerProps {
  /** 파일럿 종료까지 남은 일수 (음수 = 이미 종료). D-3/D-1/D-0 에만 배너 노출. */
  pilotRemainingDays: number
  /** customers.trial_ends_at (ISO). 없으면 날짜 미표기. */
  trialEndsAt: string | null
  /** 현재 활성 업체 수 (amount 계산용). */
  activePlaceCount: number
  /** 이미 빌링 페이지에 있을 때는 "자세히" 링크 감추기. */
  hideDetailCta?: boolean
}

function formatKstDate(iso: string): string {
  const d = new Date(iso)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * D-3 ~ D-0 에서만 렌더. 그 밖의 범위는 null 반환.
 * 긴급/위험 아님 — 초록톤 (status). "당일" 만 살짝 강조 (accent).
 */
export function PilotEndingBanner({
  pilotRemainingDays,
  trialEndsAt,
  activePlaceCount,
  hideDetailCta = false,
}: PilotEndingBannerProps) {
  if (pilotRemainingDays < 0 || pilotRemainingDays > 3) return null

  const amount = calculatePlanAmount(activePlaceCount)
  const amountText = `₩${amount.toLocaleString('ko-KR')}`
  const breakdown = `업체 ${activePlaceCount}개 × ₩${PLAN_AMOUNT_PER_PLACE.toLocaleString('ko-KR')}`
  const endDate = trialEndsAt ? formatKstDate(trialEndsAt) : null

  const headline = pilotRemainingDays === 0
    ? `오늘 ${amountText} 첫 결제 예정`
    : `D-${pilotRemainingDays} · ${endDate ? `${endDate} ` : ''}${amountText} 첫 결제 예정`

  const tone = pilotRemainingDays === 0 ? 'dash-banner accent' : 'dash-banner'

  return (
    <div className={tone} role="status" data-banner="pilot-ending">
      <div className="ic">🔔</div>
      <div>
        <b>{headline}</b>
        {activePlaceCount > 0 && (
          <span style={{ marginLeft: 8, fontSize: 12.5, color: 'var(--muted)' }}>
            {breakdown}
          </span>
        )}
      </div>
      <div className="grow" />
      {!hideDetailCta && (
        <Link href="/owner/billing" style={{ marginRight: 8 }}>
          자세히 →
        </Link>
      )}
      <Link href="/owner/billing/cancel" style={{ color: 'var(--muted)' }}>
        해지
      </Link>
    </div>
  )
}
