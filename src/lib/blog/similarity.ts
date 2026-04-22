// T-194 — Jaccard 유사도 (6-gram shingles).
// 용도:
//  - keyword-generator.ts: Haiku 생성 결과에서 기존 키워드와 0.4+ 유사 제거.
//  - similarity-guard (Phase 3): 발행 직전 최근 30일 블로그와 0.25/0.35 임계 비교.
//
// 설계:
//  - Unicode 정상화(NFC) 후 소문자화·공백 압축.
//  - 6-gram (문자 단위) — 한국어는 형태소보다 char n-gram 이 유사어·오탈자에 강건.

function normalize(text: string): string {
  return text
    .normalize('NFC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** 문자 단위 n-gram shingles. 기본 n=6. */
export function sixGramShingles(text: string, n = 6): Set<string> {
  const normalized = normalize(text)
  const set = new Set<string>()
  if (normalized.length === 0) return set

  // 짧은 문자열은 자신을 유일 shingle 로 취급 (jaccard 1 혹은 0).
  if (normalized.length < n) {
    set.add(normalized)
    return set
  }

  for (let i = 0; i <= normalized.length - n; i += 1) {
    set.add(normalized.slice(i, i + n))
  }
  return set
}

/** 두 집합의 Jaccard 유사도 (|A∩B| / |A∪B|). 0~1. 빈 집합 둘은 1. */
export function jaccard<T>(a: Set<T>, b: Set<T>): number {
  if (a.size === 0 && b.size === 0) return 1
  if (a.size === 0 || b.size === 0) return 0

  let intersection = 0
  for (const item of a) {
    if (b.has(item)) intersection += 1
  }
  const union = a.size + b.size - intersection
  return union === 0 ? 0 : intersection / union
}

/** 두 텍스트 간 Jaccard 유사도 (shingling 내부 처리). */
export function jaccardText(a: string, b: string, n = 6): number {
  return jaccard(sixGramShingles(a, n), sixGramShingles(b, n))
}

/**
 * candidate 가 existing 중 어떤 것과 threshold(기본 0.4) 이상 유사한지.
 * 반환: 유사한 기존 키워드 배열 (빈 배열 = 통과).
 */
export function findSimilarKeywords(
  candidate: string,
  existing: string[],
  threshold = 0.4,
  n = 6,
): string[] {
  const candShingles = sixGramShingles(candidate, n)
  const hits: string[] = []
  for (const other of existing) {
    const sim = jaccard(candShingles, sixGramShingles(other, n))
    if (sim >= threshold) hits.push(other)
  }
  return hits
}

/**
 * existing 배열에서 서로 중복되는 항목을 걸러 고유 키워드만 반환.
 * keyword-generator 에서 Haiku 1회 출력 내 자체 중복 제거용.
 */
export function dedupeSimilar(keywords: string[], threshold = 0.4, n = 6): string[] {
  const kept: string[] = []
  const keptShingles: Array<Set<string>> = []
  for (const kw of keywords) {
    const sh = sixGramShingles(kw, n)
    let duplicate = false
    for (const existing of keptShingles) {
      if (jaccard(sh, existing) >= threshold) {
        duplicate = true
        break
      }
    }
    if (!duplicate) {
      kept.push(kw)
      keptShingles.push(sh)
    }
  }
  return kept
}
