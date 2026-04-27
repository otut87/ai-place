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
