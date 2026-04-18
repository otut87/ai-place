export const DEFAULT_PAGE_SIZE = 20
export const MAX_PAGE_SIZE = 100

export type PlaceStatus = 'active' | 'pending' | 'rejected'

export interface ListParams {
  q: string
  city: string | null
  category: string | null
  sector: string | null
  status: PlaceStatus | null
  page: number
  pageSize: number
}

type RawInput =
  | URLSearchParams
  | Record<string, string | string[] | undefined>

function pickFirst(raw: RawInput, key: string): string | undefined {
  if (raw instanceof URLSearchParams) {
    const v = raw.get(key)
    return v ?? undefined
  }
  const v = raw[key]
  if (Array.isArray(v)) return v[0]
  return v
}

function normalizeSlug(value: string | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed || trimmed === 'all') return null
  return trimmed
}

function normalizeStatus(value: string | undefined): PlaceStatus | null {
  if (value === 'active' || value === 'pending' || value === 'rejected') return value
  return null
}

function parseIntSafe(value: string | undefined, fallback: number): number {
  if (value == null) return fallback
  const n = Number.parseInt(value, 10)
  return Number.isFinite(n) ? n : fallback
}

export function parseListParams(raw: RawInput): ListParams {
  const qRaw = pickFirst(raw, 'q') ?? ''
  const page = Math.max(1, parseIntSafe(pickFirst(raw, 'page'), 1))
  const sizeRaw = parseIntSafe(pickFirst(raw, 'pageSize'), DEFAULT_PAGE_SIZE)
  const pageSize = sizeRaw <= 0 ? DEFAULT_PAGE_SIZE : Math.min(MAX_PAGE_SIZE, sizeRaw)

  return {
    q: qRaw.trim(),
    city: normalizeSlug(pickFirst(raw, 'city')),
    category: normalizeSlug(pickFirst(raw, 'category')),
    sector: normalizeSlug(pickFirst(raw, 'sector')),
    status: normalizeStatus(pickFirst(raw, 'status')),
    page,
    pageSize,
  }
}

export function clampPage(page: number, totalPages: number): number {
  if (totalPages <= 0) return 1
  if (page < 1) return 1
  if (page > totalPages) return totalPages
  return page
}

export function buildRange(page: number, pageSize: number): { from: number; to: number } {
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  return { from, to }
}

export type PageItem = number | 'ellipsis'

export function buildPageList(
  currentPage: number,
  totalPages: number,
  window = 5,
): PageItem[] {
  if (totalPages <= 0) return []
  if (totalPages <= window + 2) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }

  const half = Math.floor(window / 2)
  let start = Math.max(2, currentPage - half)
  let end = Math.min(totalPages - 1, currentPage + half)

  if (currentPage - half <= 2) {
    start = 2
    end = Math.min(totalPages - 1, window)
  }
  if (currentPage + half >= totalPages - 1) {
    end = totalPages - 1
    start = Math.max(2, totalPages - window + 1)
  }

  const items: PageItem[] = [1]
  if (start > 2) items.push('ellipsis')
  for (let i = start; i <= end; i++) items.push(i)
  if (end < totalPages - 1) items.push('ellipsis')
  items.push(totalPages)
  return items
}
