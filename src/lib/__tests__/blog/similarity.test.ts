// T-194 — Jaccard 유사도 테스트.
import { describe, it, expect } from 'vitest'
import {
  sixGramShingles,
  jaccard,
  jaccardText,
  findSimilarKeywords,
  dedupeSimilar,
} from '@/lib/blog/similarity'

describe('sixGramShingles', () => {
  it('빈 문자열 → 빈 집합', () => {
    expect(sixGramShingles('').size).toBe(0)
  })
  it('6자 미만 → 자신 하나만', () => {
    const s = sixGramShingles('짧다')
    expect(s.size).toBe(1)
    expect(s.has('짧다')).toBe(true)
  })
  it('6자 이상 → n-gram 생성', () => {
    const s = sixGramShingles('천안 피부과 추천')
    expect(s.size).toBeGreaterThan(1)
  })
  it('NFC 정규화 + 공백 압축', () => {
    const a = sixGramShingles('천안   피부과')
    const b = sixGramShingles('천안 피부과')
    expect([...a].sort()).toEqual([...b].sort())
  })
  it('대소문자 무시', () => {
    const a = sixGramShingles('AI Place')
    const b = sixGramShingles('ai place')
    expect([...a].sort()).toEqual([...b].sort())
  })
})

describe('jaccard', () => {
  it('동일 집합 = 1', () => {
    expect(jaccard(new Set([1, 2, 3]), new Set([1, 2, 3]))).toBe(1)
  })
  it('교집합 없음 = 0', () => {
    expect(jaccard(new Set([1, 2]), new Set([3, 4]))).toBe(0)
  })
  it('일부 교집합', () => {
    // |A ∩ B| = 1, |A ∪ B| = 3 → 1/3
    expect(jaccard(new Set([1, 2]), new Set([2, 3]))).toBeCloseTo(1 / 3)
  })
  it('빈 집합 둘 = 1', () => {
    expect(jaccard(new Set(), new Set())).toBe(1)
  })
  it('한쪽만 빔 = 0', () => {
    expect(jaccard(new Set([1]), new Set())).toBe(0)
  })
})

describe('jaccardText', () => {
  it('동일 문장 = 1', () => {
    expect(jaccardText('천안 피부과 추천', '천안 피부과 추천')).toBe(1)
  })
  it('완전 다른 문장 ≈ 0', () => {
    expect(jaccardText('천안 피부과 추천', 'XYZ ABC DEF 완전 다름')).toBeLessThan(0.1)
  })
  it('부분 겹침 문장은 0과 1 사이', () => {
    const sim = jaccardText('천안 피부과 여드름', '천안 피부과 주름')
    expect(sim).toBeGreaterThan(0)
    expect(sim).toBeLessThan(1)
  })
})

describe('findSimilarKeywords', () => {
  it('임계 이상 매칭만 반환', () => {
    const existing = ['천안 피부과 여드름 치료', '서울 치과 임플란트']
    const hits = findSimilarKeywords('천안 피부과 여드름', existing, 0.3)
    expect(hits.length).toBeGreaterThan(0)
  })
  it('임계 미달은 빈 배열', () => {
    const hits = findSimilarKeywords('서울 한의원', ['천안 피부과'], 0.5)
    expect(hits).toEqual([])
  })
})

describe('dedupeSimilar', () => {
  it('서로 다른 키워드는 모두 유지', () => {
    const r = dedupeSimilar(['천안 피부과', '서울 치과', '부산 한의원'], 0.4)
    expect(r.length).toBe(3)
  })
  it('유사한 중복 제거 — 앞선 것 유지', () => {
    const r = dedupeSimilar([
      '천안 피부과 여드름 치료',
      '천안 피부과 여드름 케어',  // 위와 높은 유사도
      '서울 치과 임플란트',
    ], 0.4)
    expect(r.length).toBe(2)
    expect(r).toContain('천안 피부과 여드름 치료')
  })
})
