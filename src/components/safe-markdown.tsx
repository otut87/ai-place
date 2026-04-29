'use client'

// AI Place — 클라이언트 안전 마크다운 렌더 (T-259 / S4 fix).
//
// Codex consult #4: 자체 regex sanitizer (blog-editor.ts:120-147) 가
// `[](javascript:)`, single-quoted on-handler, `<` 시작 raw block, bold/em
// inner HTML 등을 통과시켜 stored XSS 통로였음. dangerouslySetInnerHTML 로
// 렌더되었으므로 admin preview 에서 임의 코드 실행.
//
// 서버 측은 src/lib/blog/markdown.ts:renderMarkdownToHtml 가 unified +
// rehype-sanitize defaultSchema 로 안전 처리. 클라이언트 미리보기도 동일
// 정책을 따라야 함. react-markdown + rehype-sanitize 는 이미 의존성 설치됨.

import ReactMarkdown from 'react-markdown'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import remarkGfm from 'remark-gfm'

// blog/markdown.ts 의 tableSchema 와 동일 — table 요소 + h2/h3 id 허용.
const sanitizeSchema = {
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

export function SafeMarkdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeSanitize, sanitizeSchema]]}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
