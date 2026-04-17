// 주소 정규화 유틸 (T-010)
// 도/특별시/광역시 긴 형식 → 짧은 약어, 여분 공백 축약.

const REGION_MAP: ReadonlyArray<[RegExp, string]> = [
  [/^서울특별시/, '서울'],
  [/^부산광역시/, '부산'],
  [/^대구광역시/, '대구'],
  [/^인천광역시/, '인천'],
  [/^광주광역시/, '광주'],
  [/^대전광역시/, '대전'],
  [/^울산광역시/, '울산'],
  [/^세종특별자치시/, '세종'],
  [/^경기도/, '경기'],
  [/^강원도|^강원특별자치도/, '강원'],
  [/^충청북도/, '충북'],
  [/^충청남도/, '충남'],
  [/^전라북도|^전북특별자치도/, '전북'],
  [/^전라남도/, '전남'],
  [/^경상북도/, '경북'],
  [/^경상남도/, '경남'],
  [/^제주특별자치도|^제주도/, '제주'],
]

/**
 * 한국 주소 정규화:
 * - 도/광역시 긴 형식 → 약어
 * - 다중 공백 → 단일
 */
export function normalizeAddress(raw: string | undefined): string {
  if (!raw) return ''
  let out = raw.trim()
  for (const [pattern, replace] of REGION_MAP) {
    if (pattern.test(out)) {
      out = out.replace(pattern, replace)
      break
    }
  }
  return out.replace(/\s+/g, ' ')
}
