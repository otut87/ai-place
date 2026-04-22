import { describe, it, expect } from 'vitest'
import { detectOwnerTodos, type OwnerTodoInput } from '@/lib/owner/todos'

const NOW = new Date('2026-04-22T00:00:00Z')

function makeInput(over: Partial<OwnerTodoInput> = {}): OwnerTodoInput {
  const fullPlace = {
    id: 'p1',
    name: '예쁜피부과',
    slug: 'pretty',
    city: 'cheonan',
    category: 'dermatology',
    sector: 'medical',
    description: '천안 여드름·기미·모공 레이저 전문 피부과로, 평일 저녁 야간 21시까지 진료가 가능합니다.',
    faqs: [
      { question: 'q1', answer: 'a1' },
      { question: 'q2', answer: 'a2' },
      { question: 'q3', answer: 'a3' },
    ],
    images: [
      { url: '/a.jpg', alt: 'a', type: 'exterior' as const },
      { url: '/b.jpg', alt: 'b', type: 'interior' as const },
      { url: '/c.jpg', alt: 'c', type: 'treatment' as const },
    ],
    openingHours: ['Mo-Fr 09:00-18:00'],
    reviewSummaries: [
      { source: 'Google', positiveThemes: ['친절'], negativeThemes: [], lastChecked: '2026-04-10' },
    ],
  }
  return {
    places: over.places ?? [fullPlace],
    billing: over.billing ?? { hasCard: true, pilotRemainingDays: 20 },
    medicalViolations: over.medicalViolations,
    now: over.now ?? NOW,
  }
}

describe('detectOwnerTodos', () => {
  it('모든 조건 만족 → 할일 0건', () => {
    const todos = detectOwnerTodos(makeInput())
    expect(todos).toHaveLength(0)
  })

  it('카드 미등록 + D-7 이내 → billing-card-missing HIGH', () => {
    const todos = detectOwnerTodos(makeInput({
      billing: { hasCard: false, pilotRemainingDays: 5 },
    }))
    expect(todos.some(t => t.id === 'billing-card-missing' && t.priority === 'HIGH')).toBe(true)
  })

  it('카드 미등록 + 파일럿 충분히 남음(D>7) → billing 할일 생성 안 됨', () => {
    const todos = detectOwnerTodos(makeInput({
      billing: { hasCard: false, pilotRemainingDays: 20 },
    }))
    expect(todos.some(t => t.id === 'billing-card-missing')).toBe(false)
  })

  it('파일럿 만료(음수) + 카드 없음 → billing HIGH + "파일럿 종료" 문구', () => {
    const todos = detectOwnerTodos(makeInput({
      billing: { hasCard: false, pilotRemainingDays: -3 },
    }))
    const t = todos.find(x => x.id === 'billing-card-missing')
    expect(t).toBeDefined()
    expect(t!.description).toContain('파일럿이 종료')
  })

  it('사진 2장 → photos-few HIGH', () => {
    const p = { ...makeInput().places[0], images: [
      { url: '/a.jpg', alt: 'a', type: 'exterior' as const },
      { url: '/b.jpg', alt: 'b', type: 'interior' as const },
    ] }
    const todos = detectOwnerTodos(makeInput({ places: [p] }))
    expect(todos.some(t => t.id === 'photos-few')).toBe(true)
  })

  it('FAQ 2개 → faq-missing HIGH', () => {
    const p = { ...makeInput().places[0], faqs: [
      { question: 'q1', answer: 'a1' },
      { question: 'q2', answer: 'a2' },
    ] }
    const todos = detectOwnerTodos(makeInput({ places: [p] }))
    expect(todos.some(t => t.id === 'faq-missing')).toBe(true)
  })

  it('영업시간 null → hours-missing MID', () => {
    const p = { ...makeInput().places[0], openingHours: null }
    const todos = detectOwnerTodos(makeInput({ places: [p] }))
    const t = todos.find(x => x.id === 'hours-missing')
    expect(t?.priority).toBe('MID')
  })

  it('description 30자 → description-weak MID', () => {
    const p = { ...makeInput().places[0], description: '짧은 한 줄 소개입니다.' }
    const todos = detectOwnerTodos(makeInput({ places: [p] }))
    expect(todos.some(t => t.id === 'description-weak' && t.priority === 'MID')).toBe(true)
  })

  it('리뷰 최신 수집이 60일 넘음 → reviews-stale LOW', () => {
    const p = {
      ...makeInput().places[0],
      reviewSummaries: [{
        source: 'Google',
        positiveThemes: ['친절'],
        negativeThemes: [],
        lastChecked: '2026-02-10', // NOW 로부터 71일 전
      }],
    }
    const todos = detectOwnerTodos(makeInput({ places: [p] }))
    expect(todos.some(t => t.id === 'reviews-stale' && t.priority === 'LOW')).toBe(true)
  })

  it('리뷰 수집 이력 전혀 없음 → reviews-stale', () => {
    const p = { ...makeInput().places[0], reviewSummaries: [], lastReviewCheckedAt: null }
    const todos = detectOwnerTodos(makeInput({ places: [p] }))
    expect(todos.some(t => t.id === 'reviews-stale')).toBe(true)
  })

  it('medical sector + 금칙어 탐지 → medical-check HIGH', () => {
    const todos = detectOwnerTodos(makeInput({
      medicalViolations: [{ placeId: 'p1', phrases: ['100% 완치', '완벽한 효과'] }],
    }))
    const t = todos.find(x => x.id === 'medical-check')
    expect(t).toBeDefined()
    expect(t!.priority).toBe('HIGH')
    expect(t!.description).toContain('100% 완치')
  })

  it('medical sector 아님 → medical-check 평가 안 함', () => {
    const p = { ...makeInput().places[0], sector: 'beauty' }
    const todos = detectOwnerTodos(makeInput({
      places: [p],
      medicalViolations: [{ placeId: 'p1', phrases: ['아무거나'] }],
    }))
    expect(todos.some(t => t.id === 'medical-check')).toBe(false)
  })

  it('정렬 — HIGH > MID > LOW, 같은 우선순위면 전역 먼저', () => {
    const p = {
      ...makeInput().places[0],
      description: '',
      faqs: [],
      images: [],
      openingHours: null,
      reviewSummaries: [],
    }
    const todos = detectOwnerTodos(makeInput({
      places: [p],
      billing: { hasCard: false, pilotRemainingDays: 3 },
    }))
    const priorities = todos.map(t => t.priority)
    // HIGH 가 전부 앞, LOW 가 뒤
    const firstMidIdx = priorities.indexOf('MID')
    const firstLowIdx = priorities.indexOf('LOW')
    const lastHighIdx = priorities.lastIndexOf('HIGH')
    expect(lastHighIdx).toBeLessThan(firstMidIdx < 0 ? 999 : firstMidIdx)
    if (firstMidIdx >= 0 && firstLowIdx >= 0) {
      expect(firstMidIdx).toBeLessThan(firstLowIdx)
    }
    // HIGH 구간의 첫 항목은 전역 billing (placeId=null) 여야 함
    expect(todos[0].id).toBe('billing-card-missing')
  })
})
