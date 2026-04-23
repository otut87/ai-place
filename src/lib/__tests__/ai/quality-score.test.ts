/**
 * quality-score.ts 테스트 (T-027)
 */
import { describe, it, expect } from 'vitest'
import { scoreQuality, QUALITY_SCORE_THRESHOLD } from '@/lib/ai/quality-score'

const HIGH_QUALITY = {
  businessName: '닥터에버스',
  city: '천안시',
  categoryKeyword: '피부과',
  description: '천안시 서북구 불당동 위치. 여드름·리프팅·스킨부스터 특화 피부과 전문. PDT 병행 3~6회 코스 운영, 인모드 장비 보유, 야간 진료 가능 (화·목 20시까지).',
  services: [
    { name: '여드름 레이저', description: 'PDT 병행 염증 집중 관리 3~6회 코스.', priceRange: '5~12만원' },
    { name: '리프팅', description: '인모드 1회 35분 시술.', priceRange: '25~55만원' },
    { name: '스킨부스터', description: '리쥬란 4주 간격 3회 권장.', priceRange: '18~35만원' },
  ],
  faqs: [
    { question: '닥터에버스 주차 가능한가요?', answer: '지하 주차장 2시간 무료입니다.' },
    { question: '닥터에버스 야간 진료 되나요?', answer: '화·목 20시까지 진료합니다.' },
    { question: '닥터에버스 리프팅 가격은요?', answer: '25만원~55만원대입니다.' },
    { question: '여드름 몇 회 필요한가요?', answer: '3~6회 코스를 권장합니다.' },
    { question: '초진 상담료 있나요?', answer: '상담료는 없습니다.' },
  ],
  tags: ['천안 피부과', '불당 피부과', '여드름 레이저', '리프팅', '인모드'],
}

const LOW_QUALITY = {
  businessName: '업체',
  city: '천안시',
  categoryKeyword: '피부과',
  description: '다양한 전문적인 서비스를 제공합니다. 친절하고 편안한 상담을 드립니다.',
  services: [
    { name: '피부관리', description: '다양한 서비스 제공', priceRange: '' },
  ],
  faqs: [
    { question: '예약 방법?', answer: '전화 주세요.' },
    { question: '예약 어떻게?', answer: '전화 주세요.' },
    { question: '예약해도 되나요?', answer: '전화 주세요.' },
  ],
  tags: ['피부'],
}

describe('scoreQuality', () => {
  it('고품질 샘플 → 80점 이상', () => {
    const r = scoreQuality(HIGH_QUALITY)
    expect(r.score).toBeGreaterThanOrEqual(80)
    expect(r.score).toBeLessThanOrEqual(100)
  })

  it('저품질 샘플 → 40점 이하', () => {
    const r = scoreQuality(LOW_QUALITY)
    expect(r.score).toBeLessThanOrEqual(40)
    expect(r.suggestions.length).toBeGreaterThan(0)
  })

  it('descLength: 80~160자 만점, 벗어나면 감점', () => {
    const base = { ...HIGH_QUALITY }
    const r80to160 = scoreQuality(base)
    expect(r80to160.breakdown.descLength).toBe(15)

    const rTooShort = scoreQuality({ ...base, description: '짧음.' })
    expect(rTooShort.breakdown.descLength).toBe(0)

    // 400자 — 권장 범위(160)를 훌쩍 넘어 300자까지도 넘기면 0점.
    const rTooLong = scoreQuality({
      ...base,
      description: '아'.repeat(400),
    })
    expect(rTooLong.breakdown.descLength).toBe(0)
  })

  it('keywordDensity: 업체명+지역+업종 포함 시 만점', () => {
    const r = scoreQuality(HIGH_QUALITY)
    expect(r.breakdown.keywordDensity).toBe(15)

    const rNoKeyword = scoreQuality({
      ...HIGH_QUALITY,
      description: '좋은 곳입니다. 추천합니다 여기. 가성비 좋아요 진짜로요.',
    })
    expect(rNoKeyword.breakdown.keywordDensity).toBeLessThan(15)
  })

  it('stats: 가격·숫자 포함 정도에 따라 차등', () => {
    const rHigh = scoreQuality(HIGH_QUALITY)
    expect(rHigh.breakdown.stats).toBeGreaterThanOrEqual(15)

    const rNoNum = scoreQuality({
      ...HIGH_QUALITY,
      services: [{ name: '피부관리', description: '설명', priceRange: '' }],
      faqs: [
        { question: 'a?', answer: '답변' },
        { question: 'b?', answer: '답변' },
      ],
    })
    expect(rNoNum.breakdown.stats).toBe(0)
  })

  it('faqDiversity: 5+ 개 + 질문 첫 단어 다양 시 만점', () => {
    const r = scoreQuality(HIGH_QUALITY)
    expect(r.breakdown.faqDiversity).toBeGreaterThanOrEqual(15)

    // 질문 첫 단어 모두 동일 → 낮음
    const rSame = scoreQuality({
      ...HIGH_QUALITY,
      faqs: [
        { question: '예약 방법?', answer: '전화' },
        { question: '예약 시간?', answer: '평일' },
        { question: '예약 변경?', answer: '가능' },
      ],
    })
    expect(rSame.breakdown.faqDiversity).toBeLessThan(15)
  })

  it('generic: 금칙어 많으면 감점', () => {
    const r = scoreQuality({
      ...HIGH_QUALITY,
      description: '다양한 전문적인 최고의 최상의 친절하고 편안한 서비스를 제공합니다.',
    })
    expect(r.breakdown.generic).toBe(0)
  })

  it('categoryFit: 카테고리 키워드 포함 시 만점', () => {
    const r = scoreQuality(HIGH_QUALITY)
    expect(r.breakdown.categoryFit).toBe(15)

    const rMiss = scoreQuality({
      ...HIGH_QUALITY,
      categoryKeyword: '한의원',
      services: [{ name: '피부관리', description: '일반 관리.', priceRange: '5만원' }],
      tags: ['미용'],
    })
    expect(rMiss.breakdown.categoryFit).toBe(0)
  })

  it('threshold 상수 = 70', () => {
    expect(QUALITY_SCORE_THRESHOLD).toBe(70)
  })

  it('suggestions 는 부족한 항목에만 제시', () => {
    const r = scoreQuality(HIGH_QUALITY)
    // 만점 근처 → 추천 0~2개
    expect(r.suggestions.length).toBeLessThanOrEqual(2)

    const rLow = scoreQuality(LOW_QUALITY)
    expect(rLow.suggestions.length).toBeGreaterThanOrEqual(3)
  })
})
