// T-209 — /owner/citations searchParams 해석.
// URL 모드:
//   ?days=7|30|90             → rolling 윈도우
//   ?from=YYYY-MM-DD&to=...   → 절대 범위 (월 프리셋 / 사용자 지정)
// 기본: days=30.
//
// 반환 형태는 server/client 양쪽에서 사용 (hero 의 레이블 생성용).

export type OwnerPagePeriod =
  | { mode: 'days'; days: 7 | 30 | 90; from: Date; to: Date; label: string }
  | { mode: 'month'; from: Date; to: Date; label: string; monthKey: string /* 'YYYY-MM' */ }
  | { mode: 'custom'; from: Date; to: Date; label: string }

function parseDate(iso: string | undefined): Date | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null
  const [y, m, d] = iso.split('-').map(Number)
  // KST 00:00 기준 — Asia/Seoul 는 UTC+9 고정이므로 단순 계산.
  //   KST 2026-04-01 00:00 = UTC 2026-03-31 15:00
  const utcMs = Date.UTC(y, m - 1, d) - 9 * 3600_000
  return new Date(utcMs)
}

function formatKoreanDate(d: Date): string {
  // YYYY-MM-DD (KST 기준 — Asia/Seoul 로케일)
  return d.toLocaleDateString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).replace(/\./g, '').trim().split(/\s+/).join('-')
}

/** KST 기준 해당 월의 시작/끝 경계 (UTC Date 객체로). */
export function monthBounds(year: number, monthIndex0: number): { from: Date; to: Date } {
  const from = new Date(Date.UTC(year, monthIndex0, 1) - 9 * 3600_000)
  const to = new Date(Date.UTC(year, monthIndex0 + 1, 1) - 9 * 3600_000)
  return { from, to }
}

/** KST 기준 오늘·지난달·지지난달. now 주입 가능 (테스트). */
export function monthPresets(now: Date = new Date()): Array<{
  key: 'current' | 'prev' | 'prev2'
  label: string                // '이번 달' '지난 달' '지지난 달'
  yearMonth: string            // 'YYYY-MM'
  from: Date
  to: Date
  koreanLabel: string          // '2026년 4월'
}> {
  // KST 년/월 계산
  const kstNow = new Date(now.getTime() + 9 * 3600_000)
  const y = kstNow.getUTCFullYear()
  const m0 = kstNow.getUTCMonth()
  const make = (idx: number, label: string, key: 'current' | 'prev' | 'prev2') => {
    const targetY = m0 - idx < 0 ? y - 1 : y
    const targetM = (m0 - idx + 12) % 12
    const { from, to } = monthBounds(targetY, targetM)
    const koreanLabel = `${targetY}년 ${targetM + 1}월`
    const yearMonth = `${targetY}-${String(targetM + 1).padStart(2, '0')}`
    return { key, label, yearMonth, from, to, koreanLabel }
  }
  return [make(0, '이번 달', 'current'), make(1, '지난 달', 'prev'), make(2, '지지난 달', 'prev2')]
}

/** YYYY-MM-DD 로 포맷 (인풋 value 등). */
export function toDateInputValue(d: Date): string {
  return formatKoreanDate(d)
}

export function resolveOwnerPagePeriod(
  sp: { days?: string; from?: string; to?: string },
  now: Date = new Date(),
): OwnerPagePeriod {
  const fromD = parseDate(sp.from)
  const toD = parseDate(sp.to)

  if (fromD && toD && fromD.getTime() < toD.getTime()) {
    // 절대 범위 — 월 경계에 정확히 일치하면 month 모드, 아니면 custom.
    const presets = monthPresets(now)
    for (const p of presets) {
      if (fromD.getTime() === p.from.getTime() && toD.getTime() === p.to.getTime()) {
        return { mode: 'month', from: p.from, to: p.to, label: p.koreanLabel, monthKey: p.yearMonth }
      }
    }
    // 그 외 임의 월 — from 의 KST 1일이고 to 가 다음달 1일이면 월 모드.
    const fromKst = new Date(fromD.getTime() + 9 * 3600_000)
    const toKst = new Date(toD.getTime() + 9 * 3600_000)
    const fromIsMonthStart = fromKst.getUTCDate() === 1 && fromKst.getUTCHours() === 0
    const toIsMonthStart = toKst.getUTCDate() === 1 && toKst.getUTCHours() === 0
    const monthsDiff = (toKst.getUTCFullYear() - fromKst.getUTCFullYear()) * 12 + (toKst.getUTCMonth() - fromKst.getUTCMonth())
    if (fromIsMonthStart && toIsMonthStart && monthsDiff === 1) {
      const ky = fromKst.getUTCFullYear()
      const km = fromKst.getUTCMonth()
      return {
        mode: 'month',
        from: fromD,
        to: toD,
        label: `${ky}년 ${km + 1}월`,
        monthKey: `${ky}-${String(km + 1).padStart(2, '0')}`,
      }
    }
    // 임의 구간
    return {
      mode: 'custom',
      from: fromD,
      to: toD,
      label: `${formatKoreanDate(fromD)} ~ ${formatKoreanDate(new Date(toD.getTime() - 86_400_000))}`,
    }
  }

  // days 모드
  const d = sp.days === '7' ? 7 : sp.days === '90' ? 90 : 30
  const to = now
  const from = new Date(now.getTime() - d * 86_400_000)
  return {
    mode: 'days',
    days: d as 7 | 30 | 90,
    from,
    to,
    label: `지난 ${d}일`,
  }
}
