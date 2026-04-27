// AI Place — Blog Markdown 렌더링 + sanitization (T-010d)
// 서버 측 markdown → HTML 변환. react-markdown 과 동일한 rehype-sanitize 사용.
//
// T-099 (최초): 페이지 헤더에 이미 H1 이 있으므로 본문 H1 을 H2 로 강등 — 페이지당 H1 하나 보장.
// T-195 (수정): 기존 구현은 모든 헤딩을 +1 강등시켜 LLM 이 의도한 H2 가 H3 로 떠밀려
//               헤딩 위계가 H1 → H3 점프하는 부작용 발생. H1 만 H2 로 변환하도록 좁힘 —
//               H2~H6 은 LLM 출력 그대로 보존하여 SEO/AEO 위계 정합성 회복.
//
// 사용처:
// - 블로그 글 상세 페이지 본문 렌더 (서버 컴포넌트)
// - 테스트에서 XSS 패턴 차단 검증

import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import rehypeStringify from 'rehype-stringify'
import { visit } from 'unist-util-visit'
import type { Element, Root } from 'hast'

/**
 * rehype 플러그인 — 본문의 H1 만 H2 로 변환 (페이지당 H1 하나 보장).
 * H2~H6 은 그대로 보존.
 */
function rehypeDemoteH1ToH2() {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element) => {
      if (node.tagName === 'h1') node.tagName = 'h2'
    })
  }
}

/**
 * 헤딩 텍스트 → URL-friendly slug.
 * 한글 보존(Unicode letters/numbers), 공백 → 하이픈, 80자 컷.
 */
function slugify(text: string): string {
  const normalized = text
    .toLowerCase()
    .trim()
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .slice(0, 80)
  return normalized || 'section'
}

/**
 * rehype 플러그인 — h2/h3 에 id 속성 부여 (TOC 앵커링용).
 * 같은 텍스트가 반복되면 -2, -3 식으로 disambiguate.
 */
function rehypeAddHeadingIds() {
  return (tree: Root) => {
    const seen = new Map<string, number>()
    visit(tree, 'element', (node: Element) => {
      if (node.tagName !== 'h2' && node.tagName !== 'h3') return
      const text = (node.children ?? [])
        .filter((c): c is { type: 'text'; value: string } => c.type === 'text')
        .map(c => c.value)
        .join('')
      if (!text) return
      let id = slugify(text)
      const count = seen.get(id) ?? 0
      seen.set(id, count + 1)
      if (count > 0) id = `${id}-${count + 1}`
      node.properties = { ...(node.properties ?? {}), id }
    })
  }
}

/**
 * T-253 — 본문 boilerplate strip.
 *
 * 콘텐츠 파이프라인이 markdown 본문에 박는 중복/메타 섹션 제거. page detail 은
 * `faqs`/`statistics` 컬럼을 별도 컴포넌트로 렌더하므로 본문의 같은 H2 섹션이
 * 동시에 출력되면 사용자가 같은 내용을 두 번 본다.
 *
 * 제거 대상:
 *  - `## 자주 묻는 질문` / `## FAQ` 섹션 — DB 의 `faqs` 가 비어있지 않을 때만
 *  - `## 핵심 통계` / `## 통계` 섹션 — DB 의 `statistics` 가 비어있지 않을 때만
 *  - `## 관련 업체` / `## 관련업체` 섹션 — aside-card 가 같은 정보 노출
 *  - `**타깃 검색어**: ...` 한 줄 — 내부 SEO 메타가 사용자 화면에 노출되는 버그
 *  - `※ 참고 업체 [AB]` placeholder 안내 라인
 *
 * 섹션 strip 규칙: 매칭된 H2 부터 다음 H2(`^## `) 직전까지 제거. EOF 도 종료 조건.
 */
export interface StripPostBoilerplateOpts {
  hasFaqs: boolean
  hasStatistics: boolean
}

const H2_LINE = /^## /

function isStripFaqHeader(line: string): boolean {
  return /^## ?(자주 묻는 질문|FAQ)\s*$/.test(line.trim())
}

function isStripStatsHeader(line: string): boolean {
  return /^## ?(핵심 통계|통계)\s*$/.test(line.trim())
}

function isStripRelatedHeader(line: string): boolean {
  return /^## ?관련 ?업체\s*$/.test(line.trim())
}

function shouldStripH2(line: string, opts: StripPostBoilerplateOpts): boolean {
  if (opts.hasFaqs && isStripFaqHeader(line)) return true
  if (opts.hasStatistics && isStripStatsHeader(line)) return true
  // 관련 업체는 항상 strip (page detail 의 aside-card 가 canonical UI).
  if (isStripRelatedHeader(line)) return true
  return false
}

function isStripMetaLine(line: string): boolean {
  const t = line.trim()
  // `**타깃 검색어**: 천안 여드름 피부과 추천` — 내부 SEO 메타.
  if (/^\*\*타깃 검색어\*\*\s*[::]/.test(t)) return true
  // `※ 참고 업체 A·B는 이번 분석 대상에 포함된...` placeholder 안내.
  if (/^※.*참고 업체 [AB]/.test(t)) return true
  return false
}

const TABLE_LINE = /^\s*\|/
const PLACEHOLDER_TABLE_PATTERN = /참고 ?업체 ?[AB]/

/**
 * markdown 표 블록을 인덱싱한다 — `[start, endInclusive)` 인덱스 범위 배열.
 * 표 시작 = `|` 로 시작하는 첫 라인, 표 끝 = 표가 아닌 라인 만나기 직전.
 */
function findTableRanges(lines: string[]): Array<[number, number]> {
  const ranges: Array<[number, number]> = []
  let start = -1
  for (let i = 0; i < lines.length; i++) {
    const isTable = TABLE_LINE.test(lines[i])
    if (isTable && start === -1) start = i
    else if (!isTable && start !== -1) {
      ranges.push([start, i])
      start = -1
    }
  }
  if (start !== -1) ranges.push([start, lines.length])
  return ranges
}

/**
 * "참고 업체 A/B" placeholder 가 등장하는 표 블록 인덱스를 strip 대상으로 표시.
 * markdown 표 컬럼만 깨끗이 제거하는 대신 (파싱 복잡), 표 자체를 통째로 drop —
 * placeholder 가 들어간 시점에서 그 표는 비교 신뢰도 0.
 */
function markPlaceholderTables(lines: string[]): Set<number> {
  const drop = new Set<number>()
  for (const [start, end] of findTableRanges(lines)) {
    const slice = lines.slice(start, end).join('\n')
    if (PLACEHOLDER_TABLE_PATTERN.test(slice)) {
      for (let i = start; i < end; i++) drop.add(i)
    }
  }
  return drop
}

export function stripPostBoilerplate(
  markdown: string,
  opts: StripPostBoilerplateOpts,
): string {
  const lines = markdown.split('\n')
  const dropTable = markPlaceholderTables(lines)
  const out: string[] = []
  let skip = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const isH2 = H2_LINE.test(line)

    if (skip) {
      // 새 H2 도달 — 그 자체가 또 strip 대상이면 계속 skip, 아니면 복귀.
      if (isH2) {
        if (shouldStripH2(line, opts)) continue
        skip = false
        out.push(line)
      }
      continue
    }

    if (isH2 && shouldStripH2(line, opts)) {
      skip = true
      continue
    }

    if (isStripMetaLine(line)) continue
    if (dropTable.has(i)) continue
    out.push(line)
  }

  // 끝부분 빈 줄 정리.
  while (out.length > 0 && out[out.length - 1].trim() === '') out.pop()
  return out.join('\n')
}

/**
 * 글 본문 markdown 에서 TOC 항목 추출 — h2/h3 만, rehypeAddHeadingIds 와 동일 규칙으로
 * id 생성하므로 페이지 헤딩과 1:1 매칭됨.
 */
export function extractTocFromMarkdown(
  content: string,
): Array<{ depth: 2 | 3; id: string; text: string }> {
  const result: Array<{ depth: 2 | 3; id: string; text: string }> = []
  const seen = new Map<string, number>()
  let inFence = false
  for (const line of content.split('\n')) {
    if (line.startsWith('```')) {
      inFence = !inFence
      continue
    }
    if (inFence) continue
    const m = line.match(/^(##|###)\s+(.+)$/)
    if (!m) continue
    const depth = m[1].length === 2 ? 2 : 3
    const text = m[2].trim().replace(/\*\*/g, '').replace(/`/g, '')
    if (!text) continue
    let id = slugify(text)
    const count = seen.get(id) ?? 0
    seen.set(id, count + 1)
    if (count > 0) id = `${id}-${count + 1}`
    result.push({ depth, id, text })
  }
  return result
}

/**
 * Markdown → 안전한 HTML 문자열.
 * rehype-sanitize 의 default schema 사용 (script/iframe/on* 핸들러/javascript: 차단).
 * T-195: H1 만 H2 로 변환 (T-099 의 무차별 +1 강등 제거).
 */
// T-115: rehype-sanitize 가 table 요소를 허용하도록 스키마 확장.
// T-237: h2/h3 에 id (TOC 앵커링) 허용.
const tableSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), 'table', 'thead', 'tbody', 'tr', 'th', 'td'],
  attributes: {
    ...defaultSchema.attributes,
    th: [...(defaultSchema.attributes?.th ?? []), 'align'],
    td: [...(defaultSchema.attributes?.td ?? []), 'align'],
    h2: [...(defaultSchema.attributes?.h2 ?? []), 'id'],
    h3: [...(defaultSchema.attributes?.h3 ?? []), 'id'],
  },
}

export async function renderMarkdownToHtml(md: string): Promise<string> {
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm) // T-115: Markdown 테이블 → <table> 강제
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeDemoteH1ToH2)
    .use(rehypeAddHeadingIds)
    .use(rehypeSanitize, tableSchema)
    .use(rehypeStringify)
    .process(md)
  return String(file)
}
