// 영업시간 포맷 유틸 (T-010)
// - formatHoursKo: 한글 표기 ("월-금 09:00-18:00")
// - toSchemaOrgHours: Schema.org OpeningHoursSpecification[]
//
// 입력 포맷: Schema.org 약어 ("Mo-Fr 09:00-18:00", "Sa 09:00-13:00")

type JsonObj = Record<string, unknown>

const DAY_MAP_EN: Record<string, string> = {
  Mo: 'Monday', Tu: 'Tuesday', We: 'Wednesday', Th: 'Thursday',
  Fr: 'Friday', Sa: 'Saturday', Su: 'Sunday',
}

const DAY_MAP_KO: Record<string, string> = {
  Mo: '월', Tu: '화', We: '수', Th: '목', Fr: '금', Sa: '토', Su: '일',
}

const DAY_KEYS = Object.keys(DAY_MAP_EN) // ['Mo','Tu',...'Su']

interface ParsedEntry {
  raw: string
  dayRange?: [string, string] // 예: ['Mo', 'Fr']
  singleDay?: string
  opens?: string
  closes?: string
}

function parseEntry(entry: string): ParsedEntry {
  const parsed: ParsedEntry = { raw: entry }
  const m = entry.match(/^([A-Za-z,-]+)\s+(\d{2}:\d{2})-(\d{2}:\d{2})$/)
  if (!m) return parsed
  const [, daysPart, opens, closes] = m
  parsed.opens = opens
  parsed.closes = closes
  const rangeMatch = daysPart.match(/^(\w{2})-(\w{2})$/)
  if (rangeMatch) {
    parsed.dayRange = [rangeMatch[1], rangeMatch[2]]
  } else {
    parsed.singleDay = daysPart
  }
  return parsed
}

/** 한글 표기. "Mo-Fr 09:00-18:00" → "월-금 09:00-18:00" */
export function formatHoursKo(hours: readonly string[] | undefined): string {
  if (!hours || hours.length === 0) return ''
  const parts: string[] = []
  for (const entry of hours) {
    const p = parseEntry(entry)
    if (p.dayRange && p.opens && p.closes) {
      const [s, e] = p.dayRange
      const sKo = DAY_MAP_KO[s] ?? s
      const eKo = DAY_MAP_KO[e] ?? e
      parts.push(`${sKo}-${eKo} ${p.opens}-${p.closes}`)
    } else if (p.singleDay && p.opens && p.closes) {
      const dKo = DAY_MAP_KO[p.singleDay] ?? p.singleDay
      parts.push(`${dKo} ${p.opens}-${p.closes}`)
    } else {
      parts.push(p.raw)
    }
  }
  return parts.join(', ')
}

/** Schema.org OpeningHoursSpecification[] 로 변환 */
export function toSchemaOrgHours(hours: readonly string[] | undefined): JsonObj[] {
  if (!hours || hours.length === 0) return []
  const specs: JsonObj[] = []
  for (const entry of hours) {
    const p = parseEntry(entry)
    if (!p.opens || !p.closes) continue
    if (p.dayRange) {
      const [s, e] = p.dayRange
      const sIdx = DAY_KEYS.indexOf(s)
      const eIdx = DAY_KEYS.indexOf(e)
      if (sIdx >= 0 && eIdx >= 0) {
        for (let i = sIdx; i <= eIdx; i++) {
          specs.push({
            '@type': 'OpeningHoursSpecification',
            dayOfWeek: DAY_MAP_EN[DAY_KEYS[i]],
            opens: p.opens,
            closes: p.closes,
          })
        }
      }
    } else if (p.singleDay) {
      const dow = DAY_MAP_EN[p.singleDay]
      if (dow) {
        specs.push({
          '@type': 'OpeningHoursSpecification',
          dayOfWeek: dow,
          opens: p.opens,
          closes: p.closes,
        })
      }
    }
  }
  return specs
}
