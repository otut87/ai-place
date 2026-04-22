// T-190 — 한글 slug Unicode 정규화(NFC/NFD) 불일치 방어 헬퍼.
//
// 배경: URL 바에 입력된 한글 slug 는 브라우저·OS·DB 저장 경로에 따라
// NFC(완성형) 또는 NFD(분해형) 가 섞여 Supabase `.eq('slug', ...)` 매칭이
// 실패할 수 있음. 생성 시점 정규화만으로는 레거시 데이터를 구제 못 해서
// 조회 시점에도 다중 후보로 시도.

/**
 * 주어진 slug 의 정규화 후보 배열을 반환.
 * - 원본, NFC, NFD 순서로 중복 제거하여 포함.
 * - 호출자가 각 후보로 `.eq('slug', c).maybeSingle()` 순차 시도하면 됨.
 */
export function slugMatchCandidates(slug: string): string[] {
  if (!slug) return []
  const set = new Set<string>()
  set.add(slug)
  try { set.add(slug.normalize('NFC')) } catch { /* ignore */ }
  try { set.add(slug.normalize('NFD')) } catch { /* ignore */ }
  return Array.from(set)
}

/**
 * 저장 시점 정규화 — 신규 slug 를 DB 에 넣기 전 NFC 로 통일.
 * ASCII-only slug 은 영향 없음. 한글 slug 은 완성형 고정.
 */
export function normalizeSlugForStorage(slug: string): string {
  try { return slug.normalize('NFC') } catch { return slug }
}
