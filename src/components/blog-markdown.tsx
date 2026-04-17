// 서버 컴포넌트 — markdown 본문을 sanitize 한 HTML 로 렌더.
// react-markdown 대신 unified pipeline 을 직접 호출하여 클라이언트 번들에
// markdown 라이브러리를 포함하지 않는다 (SSG 에 최적).
//
// XSS 차단: rehype-sanitize default schema (script/iframe/on*/javascript: 제거).
// 동일 sanitize 가 src/lib/blog/markdown.ts 에 있고, 단위 테스트로 검증됨.

import { renderMarkdownToHtml } from '@/lib/blog/markdown'

export async function BlogMarkdown({ content }: { content: string }) {
  const html = await renderMarkdownToHtml(content)
  return (
    <div
      className="prose prose-neutral max-w-none text-[#1a1a1a] leading-relaxed
                 prose-headings:text-[#1a1a1a] prose-headings:font-bold
                 prose-h1:text-[28px] prose-h1:mt-0 prose-h1:mb-4
                 prose-h2:text-[22px] prose-h2:mt-10 prose-h2:mb-3
                 prose-h3:text-[18px] prose-h3:mt-6 prose-h3:mb-2
                 prose-p:text-base prose-p:my-3
                 prose-li:my-1
                 prose-blockquote:border-l-4 prose-blockquote:border-[#e5e5e5]
                 prose-blockquote:pl-4 prose-blockquote:text-[#666]
                 prose-blockquote:not-italic
                 prose-a:text-[#1a1a1a] prose-a:underline hover:prose-a:no-underline
                 prose-strong:text-[#1a1a1a]"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
