import { describe, it, expect } from 'vitest'
import { computeCompleteness, PUBLIC_READY_THRESHOLD } from '@/lib/admin/completeness'
import type { CompletenessInput } from '@/lib/admin/completeness'

const FULL: CompletenessInput = {
  name: '닥터에버스',
  description: '천안시 서북구 불당동 위치. 여드름·리프팅·스킨부스터 특화 피부과 전문 진료.',
  phone: '041-123-4567',
  address: '천안시 서북구 불당동 123',
  opening_hours: ['Mo-Fr 09:00-18:00', 'Sa 09:00-13:00'],
  services: [
    { name: '여드름 레이저' }, { name: '리프팅' }, { name: '스킨부스터' },
  ],
  faqs: Array.from({ length: 5 }, (_, i) => ({ question: `Q${i}?`, answer: `A${i}` })),
  tags: ['천안', '피부과', '여드름', '리프팅', '인모드', '스킨부스터', '불당', '닥터에버스'],
  images: [{ url: 'x' }],
  kakao_map_url: 'https://map.kakao.com/x',
  naver_place_url: 'https://map.naver.com/x',
}

describe('computeCompleteness', () => {
  it('모든 항목 충족 → 100점', () => {
    const r = computeCompleteness(FULL)
    expect(r.score).toBe(100)
    expect(r.items.every(i => i.passed)).toBe(true)
  })

  it('빈 input → 0점', () => {
    const r = computeCompleteness({
      name: null, description: null, phone: null, address: null,
      opening_hours: null, services: null, faqs: null, tags: null,
      images: null, kakao_map_url: null, naver_place_url: null,
    })
    expect(r.score).toBe(0)
    expect(r.items.every(i => !i.passed)).toBe(true)
  })

  it('description 40자 미만 → 실패', () => {
    const r = computeCompleteness({ ...FULL, description: '짧음' })
    const desc = r.items.find(i => i.id === 'description')
    expect(desc?.passed).toBe(false)
  })

  it('서비스 3개 미만 → 실패', () => {
    const r = computeCompleteness({ ...FULL, services: [{ name: 's1' }, { name: 's2' }] })
    expect(r.items.find(i => i.id === 'services')?.passed).toBe(false)
  })

  it('태그 8개 미만 → 실패', () => {
    const r = computeCompleteness({ ...FULL, tags: ['a', 'b', 'c'] })
    expect(r.items.find(i => i.id === 'tags')?.passed).toBe(false)
  })

  it('이미지 없음 → 실패', () => {
    const r = computeCompleteness({ ...FULL, images: null })
    expect(r.items.find(i => i.id === 'images')?.passed).toBe(false)
  })

  it('가중합 = 100', () => {
    const r = computeCompleteness(FULL)
    const total = r.items.reduce((a, b) => a + b.weight, 0)
    expect(total).toBe(100)
  })

  it('PUBLIC_READY_THRESHOLD 는 90', () => {
    expect(PUBLIC_READY_THRESHOLD).toBe(90)
  })
})
