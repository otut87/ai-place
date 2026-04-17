'use client'

import { useEffect, useRef } from 'react'
import { incrementBlogPostView } from '@/lib/actions/blog-views'

/**
 * 블로그 글 페이지에 마운트되면 view_count 를 한 번만 증가시킨다 (fire-and-forget).
 * - StrictMode 에서 useEffect 가 두 번 호출되어도 ref guard 로 1회만 실행.
 * - 실패 시 silently 무시 (UX 영향 없음).
 */
export function BlogViewTracker({ slug }: { slug: string }) {
  const fired = useRef(false)
  useEffect(() => {
    if (fired.current) return
    fired.current = true
    incrementBlogPostView(slug).catch(() => {
      /* noop — view 측정 실패는 사용자 경험에 영향 없음 */
    })
  }, [slug])
  return null
}
