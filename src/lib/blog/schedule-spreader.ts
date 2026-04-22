// T-196 — 블로그 발행 시간 분산 스케줄러 (Phase 4).
//
// 목표: 하루 10편을 09:00 ~ 22:00 (KST) 구간에 균등 분산.
// 13시간 = 780분. count=10 이면 ~78분 간격.
// "자연스러운" 분산을 위해 결정론 jitter(±10분)를 seed 기반으로 추가.

const KST_OFFSET_MIN = 9 * 60   // UTC+9
const START_HOUR = 9
const END_HOUR = 22

/** KST 기준 (YYYY-MM-DD, HH, M) → UTC ISO 문자열. */
function kstToUtcIso(date: string, hour: number, minute: number): string {
  // date 는 'YYYY-MM-DD' 형태로 KST 기준.
  // 우리가 원하는 UTC 시각 = KST 시각 - 9h.
  // 예: KST 2026-04-22 09:00 = UTC 2026-04-22 00:00.
  const [y, m, d] = date.split('-').map(Number)
  const totalKstMin = hour * 60 + minute
  const utcMinFromMidnight = totalKstMin - KST_OFFSET_MIN
  const dayShift = Math.floor(utcMinFromMidnight / (24 * 60))
  const normMin = ((utcMinFromMidnight % (24 * 60)) + 24 * 60) % (24 * 60)
  const utcH = Math.floor(normMin / 60)
  const utcM = normMin % 60
  // Date.UTC 는 (year, month-0based, day, hour, minute) — dayShift 로 일자 이동.
  const utcMs = Date.UTC(y, m - 1, d + dayShift, utcH, utcM, 0)
  return new Date(utcMs).toISOString()
}

/** 결정론 시드 (day + idx) → -10 ~ +10 분 jitter */
function jitterMin(dateStr: string, idx: number): number {
  let h = 0
  const input = `${dateStr}-${idx}`
  for (let i = 0; i < input.length; i += 1) {
    h = (h * 31 + input.charCodeAt(i)) | 0
  }
  // h 를 -10 ~ +10 범위로 매핑
  return ((Math.abs(h) % 21) - 10)
}

export interface ScheduleSpreaderInput {
  count: number          // 기본 10
  plannedDate: string    // 'YYYY-MM-DD' — KST 기준 발행 일자
  startHour?: number     // 기본 9
  endHour?: number       // 기본 22
  jitter?: boolean       // 기본 true
}

export interface SpreadSlot {
  index: number
  kstHour: number
  kstMinute: number
  scheduledForUtc: string   // ISO
}

/**
 * count 개 슬롯을 start~end 구간에 균등 분산.
 * 첫 슬롯은 startHour, 마지막 슬롯은 endHour 에 가깝게.
 * count=1 이면 중앙 시간 (startHour+endHour)/2.
 * jitter 활성화 시 ±10분 이내 결정론 변동.
 */
export function spreadSchedule(input: ScheduleSpreaderInput): SpreadSlot[] {
  const {
    count,
    plannedDate,
    startHour = START_HOUR,
    endHour = END_HOUR,
    jitter = true,
  } = input

  if (count <= 0) return []
  if (!/^\d{4}-\d{2}-\d{2}$/.test(plannedDate)) {
    throw new Error(`spreadSchedule: invalid plannedDate "${plannedDate}"`)
  }
  if (startHour >= endHour) {
    throw new Error(`spreadSchedule: startHour(${startHour}) >= endHour(${endHour})`)
  }

  const totalMin = (endHour - startHour) * 60
  const slots: SpreadSlot[] = []

  for (let i = 0; i < count; i += 1) {
    // count=1 이면 중앙, 아니면 등간격
    const ratio = count === 1 ? 0.5 : i / (count - 1)
    const offsetMin = Math.round(ratio * totalMin)
    let minutesFromStart = offsetMin
    if (jitter) minutesFromStart += jitterMin(plannedDate, i)

    // 경계 클램프
    if (minutesFromStart < 0) minutesFromStart = 0
    if (minutesFromStart > totalMin) minutesFromStart = totalMin

    const hour = startHour + Math.floor(minutesFromStart / 60)
    const minute = minutesFromStart % 60
    slots.push({
      index: i,
      kstHour: hour,
      kstMinute: minute,
      scheduledForUtc: kstToUtcIso(plannedDate, hour, minute),
    })
  }

  return slots
}
