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
 * Markdown → 안전한 HTML 문자열.
 * rehype-sanitize 의 default schema 사용 (script/iframe/on* 핸들러/javascript: 차단).
 * T-195: H1 만 H2 로 변환 (T-099 의 무차별 +1 강등 제거).
 */
// T-115: rehype-sanitize 가 table 요소를 허용하도록 스키마 확장.
const tableSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), 'table', 'thead', 'tbody', 'tr', 'th', 'td'],
  attributes: {
    ...defaultSchema.attributes,
    th: [...(defaultSchema.attributes?.th ?? []), 'align'],
    td: [...(defaultSchema.attributes?.td ?? []), 'align'],
  },
}

export async function renderMarkdownToHtml(md: string): Promise<string> {
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm) // T-115: Markdown 테이블 → <table> 강제
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeDemoteH1ToH2)
    .use(rehypeSanitize, tableSchema)
    .use(rehypeStringify)
    .process(md)
  return String(file)
}
