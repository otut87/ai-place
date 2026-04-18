// T-069 — places.field_meta JSONB 검증/머지/렌더 라이브러리.
// 구조: { [field]: { source: 'ai:<model>' | 'manual', confidence?: 0~1, generated_at } }
// 원칙: 컬럼 산포 금지 — 1 JSONB 컬럼에서 필드별 메타를 모두 관리.

export const FIELD_META_FIELDS = [
  'description',
  'services',
  'faqs',
  'tags',
  'recommended_for',
  'strengths',
  'place_type',
  'recommendation_note',
] as const
export type FieldMetaField = (typeof FIELD_META_FIELDS)[number]

const FIELD_META_SET: ReadonlySet<string> = new Set(FIELD_META_FIELDS)

export function isMetaField(value: unknown): value is FieldMetaField {
  return typeof value === 'string' && FIELD_META_SET.has(value)
}

export interface FieldMetaEntry {
  source: string        // 'ai:sonnet-4-6' | 'ai:haiku-4-5' | 'manual' | 'import:csv'
  confidence?: number   // 0~1, AI 만 해당
  generated_at: string  // ISO 8601
}

export type FieldMeta = Partial<Record<FieldMetaField, FieldMetaEntry>>

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}

export interface BuildFieldMetaInput {
  source: string
  confidence?: number
  generatedAt?: string
}

export function buildFieldMeta(field: string, input: BuildFieldMetaInput): FieldMeta {
  if (!isMetaField(field)) return {}
  const entry: FieldMetaEntry = {
    source: input.source,
    generated_at: input.generatedAt ?? new Date().toISOString(),
  }
  if (typeof input.confidence === 'number' && Number.isFinite(input.confidence)) {
    entry.confidence = clamp01(input.confidence)
  }
  return { [field]: entry } as FieldMeta
}

/** 기존 메타 + patch 를 필드 단위로 병합. patch 가 null/undefined 이면 prev 유지. */
export function mergeFieldMeta(prev: FieldMeta | null | undefined, patch: FieldMeta | null | undefined): FieldMeta {
  const base = prev ?? {}
  if (!patch) return base
  return { ...base, ...patch }
}

/** DB 에서 읽어온 unknown → FieldMeta 로 안전 파싱 (화이트리스트 필드만 통과). */
export function parseFieldMeta(raw: unknown): FieldMeta {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: FieldMeta = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!isMetaField(k)) continue
    if (!v || typeof v !== 'object') continue
    const vo = v as Record<string, unknown>
    const source = typeof vo.source === 'string' ? vo.source : null
    const generatedAt = typeof vo.generated_at === 'string' ? vo.generated_at : null
    if (!source || !generatedAt) continue
    const entry: FieldMetaEntry = { source, generated_at: generatedAt }
    if (typeof vo.confidence === 'number' && Number.isFinite(vo.confidence)) {
      entry.confidence = clamp01(vo.confidence)
    }
    out[k] = entry
  }
  return out
}

/** 필드 옆 칩에 표시할 짧은 요약 문자열. */
export function summarizeSource(entry: FieldMetaEntry | undefined): string {
  if (!entry) return ''
  if (entry.source === 'manual') return '수동'
  if (entry.source.startsWith('ai:')) {
    const model = entry.source.slice(3)
    const conf = typeof entry.confidence === 'number' ? ` · ${entry.confidence.toFixed(2)}` : ''
    return `AI (${model})${conf}`
  }
  return entry.source
}
