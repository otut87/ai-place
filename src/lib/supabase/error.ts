// T-126 — Supabase PostgrestError 직렬화 유틸.
// 문제: PostgrestError 의 message/code/details/hint 는 non-enumerable 속성이라
//       console.error(error) 가 "{}" 로 출력됨 → 실제 DB 오류가 관리자에게 은폐.
// 해법: 알려진 필드를 명시적으로 추출해 plain object 로 만든다.

export interface SerializedSupabaseError {
  message: string
  code?: string
  details?: string | null
  hint?: string | null
  http_status?: number
  name?: string
  stack?: string
}

/**
 * Supabase/PostgrestError/일반 Error/문자열 등 어떤 값이 들어와도
 * 항상 JSON 직렬화 가능한 plain object 로 정규화한다.
 */
export function serializePostgrestError(err: unknown): SerializedSupabaseError {
  if (err === null || err === undefined) {
    return { message: 'unknown error' }
  }

  if (typeof err === 'string') {
    return { message: err }
  }

  if (err instanceof Error) {
    return {
      message: err.message || 'unknown error',
      name: err.name,
      stack: err.stack,
    }
  }

  if (typeof err === 'object') {
    const e = err as Record<string, unknown>
    const message = typeof e.message === 'string' ? e.message : ''
    const code = typeof e.code === 'string' ? e.code : undefined
    const details = typeof e.details === 'string' ? e.details : e.details === null ? null : undefined
    const hint = typeof e.hint === 'string' ? e.hint : e.hint === null ? null : undefined
    const http_status =
      typeof e.status === 'number' ? e.status : typeof e.http_status === 'number' ? e.http_status : undefined

    // 알려진 필드가 모두 비었으면 비열거(non-enumerable) 속성까지 훑어 본다.
    // Supabase v2 PostgrestError 중 일부는 속성이 non-enumerable 이라
    // Object.keys/JSON.stringify 는 `{}` 로만 보이지만, 속성 자체는 존재함.
    if (!message && !code && !details && !hint && http_status === undefined) {
      const harvested = harvestNonEnumerable(err)
      if (harvested) {
        return {
          message: harvested.message ?? 'empty error object',
          ...(harvested.code !== undefined && { code: harvested.code }),
          ...(harvested.details !== undefined && { details: harvested.details }),
          ...(harvested.hint !== undefined && { hint: harvested.hint }),
        }
      }
      return { message: 'empty error object' }
    }

    return {
      message: message || 'unknown error',
      ...(code !== undefined && { code }),
      ...(details !== undefined && { details }),
      ...(hint !== undefined && { hint }),
      ...(http_status !== undefined && { http_status }),
    }
  }

  return { message: String(err) }
}

/** getOwnPropertyNames 로 non-enumerable 속성까지 회수. */
function harvestNonEnumerable(err: object): Partial<SerializedSupabaseError> | null {
  try {
    const names = Object.getOwnPropertyNames(err)
    if (names.length === 0) return null
    const out: Partial<SerializedSupabaseError> = {}
    for (const key of names) {
      const val = (err as Record<string, unknown>)[key]
      if (key === 'message' && typeof val === 'string') out.message = val
      else if (key === 'code' && typeof val === 'string') out.code = val
      else if (key === 'details' && (typeof val === 'string' || val === null)) out.details = val as string | null
      else if (key === 'hint' && (typeof val === 'string' || val === null)) out.hint = val as string | null
    }
    return Object.keys(out).length > 0 ? out : null
  } catch {
    return null
  }
}

/**
 * 관리자 UI 에 보여줄 사용자-대면 메시지.
 * code 가 있으면 "(code: XXX)" 접미사를 붙여 원인 파악을 돕는다.
 */
export function formatUserFacingError(err: unknown): string {
  const serialized = serializePostgrestError(err)
  if (serialized.message === 'empty error object' || serialized.message === 'unknown error') {
    return '데이터를 불러오지 못했습니다'
  }
  if (serialized.code) {
    return `${serialized.message} (code: ${serialized.code})`
  }
  return serialized.message
}

/**
 * 서버 사이드 로깅용 — 모든 정보를 한 줄 문자열에 실어 출력.
 * (Next.js 16 Turbopack dev overlay 가 2번째 인자 객체를 `{}` 로만 보여주던 문제 회피.)
 */
export function logSupabaseError(tag: string, err: unknown): void {
  const s = serializePostgrestError(err)
  const parts = [`[${tag}] ${s.message}`]
  if (s.code) parts.push(`code=${s.code}`)
  if (s.details) parts.push(`details=${s.details}`)
  if (s.hint) parts.push(`hint=${s.hint}`)
  if (s.http_status) parts.push(`status=${s.http_status}`)
  console.error(parts.join(' · '))
}
