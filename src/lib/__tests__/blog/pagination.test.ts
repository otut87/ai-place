// T-248 — pageNumbers 헬퍼 검증.

import { describe, it, expect } from 'vitest'
import { pageNumbers } from '@/lib/blog/pagination'

describe('pageNumbers', () => {
  it('total ≤ 7 → 전부 노출 (생략 없음)', () => {
    expect(pageNumbers(1, 1)).toEqual([1])
    expect(pageNumbers(1, 4)).toEqual([1, 2, 3, 4])
    expect(pageNumbers(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it('current=1, total=10 → [1, 2, "...", 10]', () => {
    expect(pageNumbers(1, 10)).toEqual([1, 2, '...', 10])
  })

  it('current=10, total=10 → [1, "...", 9, 10]', () => {
    expect(pageNumbers(10, 10)).toEqual([1, '...', 9, 10])
  })

  it('current=5, total=10 → [1, "...", 4, 5, 6, "...", 10]', () => {
    expect(pageNumbers(5, 10)).toEqual([1, '...', 4, 5, 6, '...', 10])
  })

  it('current=2, total=10 → 좌측 갭 없이', () => {
    expect(pageNumbers(2, 10)).toEqual([1, 2, 3, '...', 10])
  })

  it('current=9, total=10 → 우측 갭 없이', () => {
    expect(pageNumbers(9, 10)).toEqual([1, '...', 8, 9, 10])
  })

  it('current=4, total=10 → 좌측 갭 (3은 노출, 2는 갭으로 가려짐)', () => {
    // current-1=3, left=Math.max(2,3)=3 → 3 > 2 이므로 갭 push
    expect(pageNumbers(4, 10)).toEqual([1, '...', 3, 4, 5, '...', 10])
  })

  it('current=7, total=10 → 우측 갭', () => {
    // right=8, total-1=9, 8 < 9 이므로 갭 push
    expect(pageNumbers(7, 10)).toEqual([1, '...', 6, 7, 8, '...', 10])
  })

  it('total=8 (경계) — 생략 등장', () => {
    expect(pageNumbers(4, 8)).toEqual([1, '...', 3, 4, 5, '...', 8])
  })
})
