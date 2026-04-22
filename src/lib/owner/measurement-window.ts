// Sprint D-1 / T-200 — 15일 측정 윈도 (OWNER_DASHBOARD_PLAN.md §1).
//
// 왜 15일: AI 봇이 새 URL 발견·크롤링까지 평균 3~10일.
// 초반 2주는 표본 부족 — "AI 인용 없음" 오해 유발.
// D<15 구간에선 모든 AI 집계 수치를 가리고 카운트다운만 노출한다.
//
// 기준: 오너 소유 업체 중 가장 이른 place.created_at. 업체 없음 → daysElapsed=0.

export const MEASUREMENT_WINDOW_DAYS = 15

export interface MeasurementWindow {
  /** 경과 일수 (소수점 버림, 미래 날짜는 0 으로 보정). */
  daysElapsed: number
  /** MEASUREMENT_WINDOW_DAYS - daysElapsed 의 clamp 결과. D>=15 이면 0. */
  daysRemaining: number
  /** D<MEASUREMENT_WINDOW_DAYS 인 동안 true — KPI 는 "측정 중" 오버레이. */
  isMeasuring: boolean
  /** 기준이 된 가장 이른 업체 생성 시각 (없으면 null). */
  referenceCreatedAt: string | null
  /** UI 문자열: "D-12" / "D-0 · 내일 공개" / "측정 완료". */
  label: string
}

const DAY_MS = 86_400_000

/**
 * 경과 일수 = floor((now - createdAt) / 1 day).
 * createdAt 이 미래(시계 오차)면 0 으로 보정.
 */
function computeDaysElapsed(createdAtIso: string, nowMs: number): number {
  const ts = Date.parse(createdAtIso)
  if (!Number.isFinite(ts)) return 0
  const diff = nowMs - ts
  if (diff <= 0) return 0
  return Math.floor(diff / DAY_MS)
}

/** 여러 업체 생성 시각 중 가장 이른 것을 기준으로 측정 윈도 계산. */
export function getMeasurementWindow(
  placeCreatedAts: ReadonlyArray<string | null | undefined>,
  now: Date = new Date(),
): MeasurementWindow {
  const nowMs = now.getTime()
  let earliest: string | null = null
  for (const iso of placeCreatedAts) {
    if (!iso) continue
    if (!earliest || iso < earliest) earliest = iso
  }

  if (!earliest) {
    return {
      daysElapsed: 0,
      daysRemaining: MEASUREMENT_WINDOW_DAYS,
      isMeasuring: true,
      referenceCreatedAt: null,
      label: `D-${MEASUREMENT_WINDOW_DAYS}`,
    }
  }

  const daysElapsed = computeDaysElapsed(earliest, nowMs)
  const daysRemaining = Math.max(0, MEASUREMENT_WINDOW_DAYS - daysElapsed)
  const isMeasuring = daysElapsed < MEASUREMENT_WINDOW_DAYS

  let label: string
  if (!isMeasuring) {
    label = '측정 완료'
  } else if (daysRemaining === 0) {
    // daysElapsed === 15 이면 isMeasuring=false 로 빠져 이 분기에 오지 않음 — 방어적.
    label = 'D-0 · 내일 공개'
  } else if (daysRemaining === 1) {
    label = 'D-1 · 내일 공개'
  } else {
    label = `D-${daysRemaining}`
  }

  return {
    daysElapsed,
    daysRemaining,
    isMeasuring,
    referenceCreatedAt: earliest,
    label,
  }
}
