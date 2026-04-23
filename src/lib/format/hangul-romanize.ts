// T-217 — 한글 → 영문 로마자(Revised Romanization) 변환.
// 편집 폼에서 업체명 한글을 name_en 필드에 자동 입력할 때 사용.
// 완벽한 음운 규칙(자음 동화 등)은 적용하지 않고 음절 단위 1:1 매핑 — 검색/AI 인식에는 충분.

const INITIALS = [
  'g', 'kk', 'n', 'd', 'tt', 'r', 'm', 'b', 'pp', 's',
  'ss', '', 'j', 'jj', 'ch', 'k', 't', 'p', 'h',
]

const MEDIALS = [
  'a', 'ae', 'ya', 'yae', 'eo', 'e', 'yeo', 'ye', 'o',
  'wa', 'wae', 'oe', 'yo', 'u', 'wo', 'we', 'wi', 'yu', 'eu', 'ui', 'i',
]

// 받침(종성) — 음절 끝이면 평음화 규칙 약식 적용.
const FINALS = [
  '', 'k', 'k', 'k', 'n', 'n', 'n', 't', 'l', 'k',
  'm', 'l', 'l', 'l', 'l', 'l', 'm', 'p', 'p', 't',
  't', 'ng', 't', 't', 'k', 't', 'p', 'h',
]

const SYLLABLE_START = 0xac00
const SYLLABLE_END = 0xd7a3

/**
 * 한글 문자열을 Revised Romanization 형태의 영문으로 변환.
 * - 한글 음절 블록 → 자/모/받침 분해 후 매핑
 * - 영문/숫자/공백은 그대로 유지
 * - 괄호·구두점은 그대로 두지만, 연속 공백은 정리
 * - 각 음절 이어붙이는 공백은 한글 단어 사이에만 삽입하지 않고,
 *   대신 한 단어 통째로 붙여 전체 단어를 한 chunk 로 읽히게 함 (업체명에 적합).
 */
export function romanizeKorean(input: string): string {
  if (!input) return ''
  let out = ''
  for (const ch of input) {
    const code = ch.codePointAt(0)
    if (code === undefined) continue
    if (code >= SYLLABLE_START && code <= SYLLABLE_END) {
      const idx = code - SYLLABLE_START
      const initial = Math.floor(idx / 588)
      const medial = Math.floor((idx % 588) / 28)
      const final = idx % 28
      out += INITIALS[initial] + MEDIALS[medial] + FINALS[final]
    } else if (/[A-Za-z0-9]/.test(ch)) {
      out += ch
    } else if (ch === ' ' || ch === '\t' || ch === '\n') {
      out += ' '
    } else if (/[()[\]{}·.\-·&,]/.test(ch)) {
      // 약식: 영문명에서 괄호 앞뒤 공백을 깨지 않도록 구두점은 생략.
      out += ''
    } else {
      // 기타 특수문자 생략.
      out += ''
    }
  }
  return out.replace(/\s+/g, ' ').trim()
}

/**
 * 업체명 한글 → 영문명 초안 (Title Case).
 * 예: "클린휴 의원" → "Cleanhyu Uiwon" → 공백 기준 Title Case.
 */
export function suggestEnglishName(koreanName: string): string {
  const rom = romanizeKorean(koreanName)
  if (!rom) return ''
  return rom
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}
