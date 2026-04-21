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
      className="prose prose-neutral max-w-none text-[#1a1a1a] leading-[1.75]
                 prose-headings:text-[#1a1a1a] prose-headings:font-bold prose-headings:tracking-tight
                 prose-h1:text-[28px] prose-h1:mt-0 prose-h1:mb-4
                 prose-h2:text-[24px] prose-h2:mt-12 prose-h2:mb-4 prose-h2:pb-2 prose-h2:border-b prose-h2:border-[#e5e5e5]
                 prose-h3:text-[20px] prose-h3:mt-10 prose-h3:mb-3
                 prose-h4:text-[17px] prose-h4:mt-6 prose-h4:mb-2
                 prose-p:text-[15px] prose-p:my-4 prose-p:leading-[1.8]
                 prose-ul:my-4 prose-ol:my-4 prose-li:my-1.5 prose-li:leading-[1.75]
                 prose-blockquote:border-l-4 prose-blockquote:border-[#1a1a1a]
                 prose-blockquote:pl-5 prose-blockquote:py-1 prose-blockquote:text-[#444]
                 prose-blockquote:not-italic prose-blockquote:bg-[#fafafa]
                 prose-a:text-[#008060] prose-a:underline prose-a:underline-offset-2
                 hover:prose-a:no-underline
                 prose-strong:text-[#1a1a1a] prose-strong:font-semibold
                 prose-code:text-[#c2410c] prose-code:bg-[#f5f5f5]
                 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
                 prose-code:before:content-none prose-code:after:content-none
                 prose-hr:my-10 prose-hr:border-[#e5e5e5]
                 [&_table]:my-6 [&_table]:w-full [&_table]:border-collapse
                 [&_table]:text-[14px]
                 [&_thead]:bg-[#f9f9f9]
                 [&_th]:border [&_th]:border-[#e5e5e5] [&_th]:px-3 [&_th]:py-2.5
                 [&_th]:text-left [&_th]:font-semibold [&_th]:text-[#1a1a1a]
                 [&_td]:border [&_td]:border-[#e5e5e5] [&_td]:px-3 [&_td]:py-2.5
                 [&_td]:align-top"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
