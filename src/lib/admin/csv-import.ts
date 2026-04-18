export const CSV_TEMPLATE_HEADERS = [
  'name',
  'city',
  'category',
  'slug',
  'address',
  'phone',
  'description',
  'tags',
] as const

export interface ParsedCsv {
  headers: string[]
  rows: Record<string, string>[]
}

export function parseCsv(text: string): ParsedCsv {
  if (!text || !text.trim()) {
    throw new Error('CSV가 비어 있습니다.')
  }

  const rows = tokenize(text)
  if (rows.length === 0) throw new Error('CSV에 데이터가 없습니다.')

  const headers = rows[0].map((h) => h.trim())
  const body = rows.slice(1).filter((r) => r.some((cell) => cell.trim() !== ''))

  const parsed = body.map((cells) => {
    const obj: Record<string, string> = {}
    headers.forEach((h, i) => {
      obj[h] = cells[i] ?? ''
    })
    return obj
  })

  return { headers, rows: parsed }
}

function tokenize(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cell += ch
      }
      continue
    }

    if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      row.push(cell)
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else {
      cell += ch
    }
  }

  if (cell !== '' || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }
  return rows
}

export interface NormalizedRow {
  name: string
  city: string
  category: string
  slug: string
  address: string
  phone: string
  description: string
  tags: string[]
}

export interface NormalizeContext {
  cities: string[]
  categories: string[]
}

export function normalizeRow(raw: Record<string, string>, _ctx: NormalizeContext): NormalizedRow {
  return {
    name: (raw.name ?? '').trim(),
    city: (raw.city ?? '').trim().toLowerCase(),
    category: (raw.category ?? '').trim().toLowerCase(),
    slug: (raw.slug ?? '').trim().toLowerCase(),
    address: (raw.address ?? '').trim(),
    phone: (raw.phone ?? '').trim(),
    description: (raw.description ?? '').trim(),
    tags: (raw.tags ?? '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
  }
}

const SLUG_RE = /^[a-z0-9-]+$/
const PHONE_RE = /^[\d\s\-+()]+$/

export type ValidationResult = { ok: true } | { ok: false; errors: string[] }

export function validateCsvRow(row: NormalizedRow, ctx: NormalizeContext): ValidationResult {
  const errors: string[] = []
  if (!row.name) errors.push('업체명이 비어 있습니다.')
  if (!ctx.cities.includes(row.city)) errors.push(`도시 ${row.city || '(empty)'} 가 유효하지 않습니다.`)
  if (!ctx.categories.includes(row.category)) errors.push(`업종 ${row.category || '(empty)'} 가 유효하지 않습니다.`)
  if (!row.slug) errors.push('슬러그가 필요합니다.')
  else if (!SLUG_RE.test(row.slug)) errors.push('슬러그는 소문자·숫자·하이픈만 허용됩니다.')
  if (!row.address) errors.push('주소가 필요합니다.')
  if (!row.phone) errors.push('전화번호가 필요합니다.')
  else if (!PHONE_RE.test(row.phone)) errors.push('전화번호 형식이 올바르지 않습니다.')
  if (!row.description || row.description.length < 10) errors.push('소개 문구가 너무 짧습니다.')

  return errors.length === 0 ? { ok: true } : { ok: false, errors }
}

export function summarizeImport({ success, failed }: { success: number; failed: number }): string {
  if (success === 0 && failed === 0) return '가져올 행이 없습니다'
  if (failed === 0) return `${success}개 등록 완료`
  if (success === 0) return `${failed}개 모두 실패`
  return `${success}개 등록 · ${failed}개 실패`
}
