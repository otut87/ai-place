// T-096 — 페이지 title 조립 유틸.
// layout.tsx 의 `template: "%s | AI Place"` 가 접미사를 자동 부착하므로,
// 개별 page metadata 의 title 에는 접미사를 붙이지 말아야 한다.
// 기존 코드가 `"${post.title} | AI Place"` 식으로 수동 부착해 중복 발생 → 이 유틸이 방어.

export const SITE_TITLE_SUFFIX = '| AI Place' as const
export const SITE_TITLE_DEFAULT = 'AI Place' as const

const SUFFIX_PATTERN = /\s*\|\s*AI Place\s*/gi

/**
 * 개별 페이지의 title 문자열에서 이미 부착된 "| AI Place" 접미사를 모두 제거.
 * layout.tsx 의 Metadata `template` 이 1회만 부착하도록 맡긴다.
 *
 * 접두사 형태("AI Place 소개 —")는 접미사가 아니므로 건드리지 않는다.
 */
export function composePageTitle(raw: string | undefined | null): string {
  if (!raw) return SITE_TITLE_DEFAULT
  const stripped = raw.replace(SUFFIX_PATTERN, '').trim()
  return stripped.length > 0 ? stripped : SITE_TITLE_DEFAULT
}
