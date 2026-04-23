// T-217 — 구조화된 영업시간 입력 지원.
// Schema.org 약어 포맷("Mo-Fr 09:00-18:00", "Sa 09:00-13:00") ↔ 요일별 map 간 변환.
// 편집 폼에서 요일 체크박스 + 시:분 select 로 입력받은 뒤 저장 직전 배열로 직렬화.

export type DayCode = 'Mo' | 'Tu' | 'We' | 'Th' | 'Fr' | 'Sa' | 'Su'

export const DAY_ORDER: readonly DayCode[] = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

export const DAY_LABEL_KO: Record<DayCode, string> = {
  Mo: '월', Tu: '화', We: '수', Th: '목', Fr: '금', Sa: '토', Su: '일',
}

export interface DayHours {
  /** closed=true 면 open/close 는 무시. */
  closed: boolean
  /** "HH:MM" (24h) */
  open: string
  /** "HH:MM" (24h) */
  close: string
}

export type HoursMap = Record<DayCode, DayHours>

const DEFAULT_OPEN = '09:00'
const DEFAULT_CLOSE = '18:00'

/** 모든 요일 닫힘으로 초기화. */
export function emptyHoursMap(): HoursMap {
  const map = {} as HoursMap
  for (const d of DAY_ORDER) {
    map[d] = { closed: true, open: DEFAULT_OPEN, close: DEFAULT_CLOSE }
  }
  return map
}

/**
 * Schema.org 문자열 배열 → 요일 map.
 * 예: ["Mo-Fr 09:00-18:00", "Sa 09:00-13:00"]
 *   → Mo~Fr open, Sa open(09~13), Su closed
 * 파싱 실패 엔트리는 무시 (기존 자유 입력 방어).
 */
export function parseHoursArray(hours: readonly string[] | null | undefined): HoursMap {
  const map = emptyHoursMap()
  if (!hours) return map
  for (const entry of hours) {
    const m = entry.match(/^([A-Za-z]{2}(?:-[A-Za-z]{2})?)\s+(\d{2}:\d{2})-(\d{2}:\d{2})$/)
    if (!m) continue
    const [, daysPart, open, close] = m
    const range = daysPart.match(/^([A-Za-z]{2})-([A-Za-z]{2})$/)
    const days = range ? expandRange(range[1] as DayCode, range[2] as DayCode) : [daysPart as DayCode]
    for (const d of days) {
      if (!DAY_ORDER.includes(d)) continue
      map[d] = { closed: false, open, close }
    }
  }
  return map
}

function expandRange(start: DayCode, end: DayCode): DayCode[] {
  const s = DAY_ORDER.indexOf(start)
  const e = DAY_ORDER.indexOf(end)
  if (s < 0 || e < 0 || e < s) return []
  return DAY_ORDER.slice(s, e + 1)
}

/**
 * 요일 map → Schema.org 문자열 배열.
 * 연속된 같은 시간의 요일을 범위로 압축 (Mo~Fr 09-18 형태).
 * 닫힌 요일은 제외.
 */
export function serializeHoursMap(map: HoursMap): string[] {
  const out: string[] = []
  let runStart: DayCode | null = null
  let runEnd: DayCode | null = null
  let runOpen = ''
  let runClose = ''

  const flush = () => {
    if (!runStart || !runEnd) return
    const prefix = runStart === runEnd ? runStart : `${runStart}-${runEnd}`
    out.push(`${prefix} ${runOpen}-${runClose}`)
    runStart = runEnd = null
    runOpen = runClose = ''
  }

  for (const d of DAY_ORDER) {
    const h = map[d]
    if (h.closed) {
      flush()
      continue
    }
    if (runStart && runOpen === h.open && runClose === h.close) {
      runEnd = d
    } else {
      flush()
      runStart = d
      runEnd = d
      runOpen = h.open
      runClose = h.close
    }
  }
  flush()
  return out
}

/** HH:MM select option 생성 — 00:00 ~ 23:30, 30분 단위. */
export function timeOptions(): string[] {
  const list: string[] = []
  for (let h = 0; h < 24; h += 1) {
    for (const m of [0, 30]) {
      list.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
    }
  }
  return list
}

/** 프리셋 — 오너가 빠르게 세팅. */
export interface HoursPreset {
  id: string
  label: string
  description: string
  apply(map: HoursMap): HoursMap
}

export const HOURS_PRESETS: readonly HoursPreset[] = [
  {
    id: 'weekday9to6',
    label: '평일 9-18시',
    description: '월–금 / 주말 휴무',
    apply: () => ({
      Mo: { closed: false, open: '09:00', close: '18:00' },
      Tu: { closed: false, open: '09:00', close: '18:00' },
      We: { closed: false, open: '09:00', close: '18:00' },
      Th: { closed: false, open: '09:00', close: '18:00' },
      Fr: { closed: false, open: '09:00', close: '18:00' },
      Sa: { closed: true, open: '09:00', close: '18:00' },
      Su: { closed: true, open: '09:00', close: '18:00' },
    }),
  },
  {
    id: 'weekdaySat',
    label: '평일+토 오전',
    description: '월–금 9–19시, 토 9–13시',
    apply: () => ({
      Mo: { closed: false, open: '09:00', close: '19:00' },
      Tu: { closed: false, open: '09:00', close: '19:00' },
      We: { closed: false, open: '09:00', close: '19:00' },
      Th: { closed: false, open: '09:00', close: '19:00' },
      Fr: { closed: false, open: '09:00', close: '19:00' },
      Sa: { closed: false, open: '09:00', close: '13:00' },
      Su: { closed: true, open: '09:00', close: '18:00' },
    }),
  },
  {
    id: 'everyday',
    label: '연중무휴',
    description: '매일 동일 시간',
    apply: () => ({
      Mo: { closed: false, open: '10:00', close: '21:00' },
      Tu: { closed: false, open: '10:00', close: '21:00' },
      We: { closed: false, open: '10:00', close: '21:00' },
      Th: { closed: false, open: '10:00', close: '21:00' },
      Fr: { closed: false, open: '10:00', close: '21:00' },
      Sa: { closed: false, open: '10:00', close: '21:00' },
      Su: { closed: false, open: '10:00', close: '21:00' },
    }),
  },
]
