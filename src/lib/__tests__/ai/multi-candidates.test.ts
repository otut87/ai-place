/**
 * multi-candidates.ts 테스트 (T-052)
 * 다중 후보 LLM 결과 병합·순위·큐레이션 헬퍼.
 */
import { describe, it, expect } from 'vitest'
import {
  rankDescriptionCandidates,
  mergeServicePool,
  mergeFaqPool,
  mergeTagPool,
  buildCandidatePool,
  normalizeForDedup,
  type ContentCandidate,
  type RankContext,
} from '@/lib/ai/multi-candidates'

const CTX: RankContext = {
  businessName: '닥터에버스',
  city: '천안시',
  categoryKeyword: '피부과',
}

function svc(name: string, priceRange = '', description = ''): { name: string; description?: string; priceRange?: string } {
  return { name, description, priceRange }
}
function faq(question: string, answer: string) {
  return { question, answer }
}

const HIGH_DESC = '천안시 불당동 위치. 여드름·리프팅·스킨부스터 특화 피부과 전문.'
const MID_DESC = '천안시 위치. 피부 시술 전문.'
const LOW_DESC = '다양한 전문적인 친절하고 편안한 서비스를 최고의 품질로 제공합니다 진짜.'

describe('normalizeForDedup', () => {
  it('공백·구두점·대소문자 제거', () => {
    expect(normalizeForDedup('닥터에버스, 주차 가능?')).toBe('닥터에버스주차가능')
    expect(normalizeForDedup('  ABC  de!f  ')).toBe('abcdef')
  })
})

describe('rankDescriptionCandidates', () => {
  it('고품질 후보가 상위에 배치된다', () => {
    const candidates = [LOW_DESC, MID_DESC, HIGH_DESC]
    const ranked = rankDescriptionCandidates(candidates, CTX, {
      services: [svc('여드름 레이저', '5~12만원')],
      faqs: [faq('닥터에버스 주차 가능한가요?', '지하 주차장 2시간 무료입니다.')],
      tags: ['천안 피부과'],
    })
    expect(ranked[0].text).toBe(HIGH_DESC)
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score)
  })

  it('중복 후보는 상위 1개만 남긴다', () => {
    const dup = '천안시 불당동. 피부과 전문.'
    const ranked = rankDescriptionCandidates([dup, dup, dup], CTX, {
      services: [], faqs: [], tags: [],
    })
    expect(ranked).toHaveLength(1)
  })

  it('빈 배열이면 빈 결과', () => {
    expect(rankDescriptionCandidates([], CTX, { services: [], faqs: [], tags: [] })).toEqual([])
  })
})

describe('mergeServicePool', () => {
  it('여러 후보의 서비스를 합치고 이름 기준 dedup', () => {
    const candidates: ContentCandidate[] = [
      { description: '', services: [svc('여드름 레이저', '5~12만원'), svc('리프팅', '25~55만원')], faqs: [], tags: [] },
      { description: '', services: [svc('여드름레이저', '6~13만원'), svc('스킨부스터', '18~35만원')], faqs: [], tags: [] },
      { description: '', services: [svc('보톡스', '10만원~'), svc('리프팅', '')], faqs: [], tags: [] },
    ]
    const pool = mergeServicePool(candidates, CTX)
    const names = pool.map(s => s.name)
    // 중복 제거: '여드름 레이저' / '여드름레이저'는 같은 키로 dedup (첫 등장만)
    expect(names).toContain('여드름 레이저')
    expect(names).not.toContain('여드름레이저')
    // 가격 있는 후보가 빈 가격 후보보다 우선 (리프팅: '25~55만원' 유지)
    const lifting = pool.find(s => s.name === '리프팅')
    expect(lifting?.priceRange).toBe('25~55만원')
  })

  it('카테고리 키워드 포함 서비스를 상위로', () => {
    const candidates: ContentCandidate[] = [
      { description: '', services: [svc('방문 상담'), svc('피부 레이저')], faqs: [], tags: [] },
    ]
    const pool = mergeServicePool(candidates, CTX)
    expect(pool[0].name).toBe('피부 레이저')
  })

  it('최대 개수 제한', () => {
    const many: ContentCandidate[] = [
      {
        description: '',
        services: Array.from({ length: 12 }, (_, i) => svc(`피부 시술 ${i}`, '10만원')),
        faqs: [],
        tags: [],
      },
    ]
    const pool = mergeServicePool(many, CTX, { max: 7 })
    expect(pool).toHaveLength(7)
  })
})

describe('mergeFaqPool', () => {
  it('질문 기준 dedup + 최대 개수 제한', () => {
    const candidates: ContentCandidate[] = [
      { description: '', services: [], faqs: [
        faq('닥터에버스 주차 가능한가요?', '지하 2시간 무료.'),
        faq('닥터에버스 야간 진료 되나요?', '화·목 20시까지.'),
      ], tags: [] },
      { description: '', services: [], faqs: [
        faq('닥터에버스 주차 가능한가요??', '주차장 있습니다.'), // dedup with 첫 번째
        faq('닥터에버스 리프팅 가격은요?', '25~55만원.'),
      ], tags: [] },
    ]
    const pool = mergeFaqPool(candidates, CTX, { max: 5 })
    expect(pool.length).toBeLessThanOrEqual(5)
    const questions = pool.map(q => q.question)
    const uniqueCount = new Set(questions.map(normalizeForDedup)).size
    expect(uniqueCount).toBe(questions.length)
  })

  it('수치 포함 답변을 상위로', () => {
    const candidates: ContentCandidate[] = [
      { description: '', services: [], faqs: [
        faq('예약 방법?', '전화 주세요.'),
        faq('영업시간?', '화·목 20시까지 진료합니다.'),
      ], tags: [] },
    ]
    const pool = mergeFaqPool(candidates, CTX)
    expect(pool[0].question).toBe('영업시간?')
  })
})

describe('mergeTagPool', () => {
  it('중복 태그는 빈도 순 정렬', () => {
    const candidates: ContentCandidate[] = [
      { description: '', services: [], faqs: [], tags: ['천안 피부과', '여드름', '리프팅'] },
      { description: '', services: [], faqs: [], tags: ['천안 피부과', '여드름'] },
      { description: '', services: [], faqs: [], tags: ['인모드'] },
    ]
    const pool = mergeTagPool(candidates)
    expect(pool[0]).toBe('천안 피부과')
    expect(pool[1]).toBe('여드름')
    expect(pool).toContain('인모드')
    expect(new Set(pool).size).toBe(pool.length)
  })

  it('최대 개수 제한', () => {
    const tags = Array.from({ length: 20 }, (_, i) => `태그${i}`)
    const pool = mergeTagPool([{ description: '', services: [], faqs: [], tags }], { max: 8 })
    expect(pool).toHaveLength(8)
  })
})

describe('buildCandidatePool (통합)', () => {
  it('여러 후보를 하나의 큐레이션 풀로 병합', () => {
    const candidates: ContentCandidate[] = [
      {
        description: HIGH_DESC,
        services: [svc('여드름 레이저', '5~12만원'), svc('리프팅', '25~55만원')],
        faqs: [faq('닥터에버스 주차 가능한가요?', '지하 2시간 무료입니다.')],
        tags: ['천안 피부과', '여드름'],
      },
      {
        description: MID_DESC,
        services: [svc('스킨부스터', '18~35만원')],
        faqs: [faq('닥터에버스 야간 진료 되나요?', '화·목 20시까지.')],
        tags: ['천안 피부과', '리프팅'],
      },
      {
        description: LOW_DESC,
        services: [svc('보톡스', '10만원~')],
        faqs: [faq('닥터에버스 리프팅 가격은요?', '25만원~55만원입니다.')],
        tags: ['인모드'],
      },
    ]
    const pool = buildCandidatePool(candidates, CTX, {
      descriptionTop: 3, serviceMax: 7, faqMax: 5, tagMax: 8,
    })
    expect(pool.descriptions.length).toBeGreaterThanOrEqual(1)
    expect(pool.descriptions[0].text).toBe(HIGH_DESC)
    expect(pool.services.length).toBeLessThanOrEqual(7)
    expect(pool.services.length).toBeGreaterThan(0)
    expect(pool.faqs.length).toBeLessThanOrEqual(5)
    expect(pool.tags).toContain('천안 피부과')
  })

  it('빈 후보 목록은 빈 풀 반환', () => {
    const pool = buildCandidatePool([], CTX)
    expect(pool.descriptions).toEqual([])
    expect(pool.services).toEqual([])
    expect(pool.faqs).toEqual([])
    expect(pool.tags).toEqual([])
  })
})
