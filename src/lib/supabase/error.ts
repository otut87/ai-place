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

    if (!message && !code && !details && !hint && http_status === undefined) {
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
 * 서버 사이드 로깅용 — console.error 에 넘길 때 이 함수를 경유하면
 * 빈 객체로 찍히는 사태를 방지한다.
 */
export function logSupabaseError(tag: string, err: unknown): void {
  const serialized = serializePostgrestError(err)
  console.error(`[${tag}]`, serialized)
}
