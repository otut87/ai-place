// T-060 — Analytics 를 로드하지 않을 경로 판별.
// 운영자 트래픽(/admin/*, /owner/*, /admin/login)은 GA 지표에서 제외.

const SUPPRESSED_PREFIXES = ['/admin', '/owner'] as const

export function isAnalyticsSuppressedPath(pathname: string): boolean {
  if (!pathname) return false
  return SUPPRESSED_PREFIXES.some(prefix =>
    pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}
