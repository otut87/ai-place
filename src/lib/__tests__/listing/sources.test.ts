// 카테고리별 출처·방법론·가격 라벨 카탈로그의 sector override 동작 검증.

import { describe, it, expect } from 'vitest'
import { getSourcesForCategory } from '@/lib/listing/sources'

describe('getSourcesForCategory', () => {
  it('sector 미지정 시 base 출처·방법론·가격 라벨 반환', () => {
    const cfg = getSourcesForCategory({})
    expect(cfg.priceLabel).toBe('기본 단가')
    expect(cfg.sources.length).toBeGreaterThanOrEqual(3)
    expect(cfg.sources.some(s => s.name === '네이버 플레이스')).toBe(true)
    expect(cfg.methodology.length).toBeGreaterThanOrEqual(3)
    expect(cfg.methodology.some(m => m.includes('사업자등록번호'))).toBe(true)
  })

  it('의료 카테고리는 건강보험심사평가원 + 의료광고법 고지가 포함된다', () => {
    const cfg = getSourcesForCategory({ sectorSlug: 'medical' })
    expect(cfg.priceLabel).toBe('시술 시작가')
    expect(cfg.sources.some(s => s.name === '건강보험심사평가원')).toBe(true)
    expect(cfg.methodology.some(m => m.includes('의료광고법') || m.includes('부작용'))).toBe(true)
  })

  it('생활서비스(인테리어 등)는 KISCON 면허 검증이 포함된다', () => {
    const cfg = getSourcesForCategory({ sectorSlug: 'living' })
    expect(cfg.priceLabel).toBe('기본 단가')
    expect(cfg.sources.some(s => s.name.includes('KISCON') || s.detail.includes('실내건축업'))).toBe(true)
  })

  it('자동차 sector 는 자동차관리법 정비업 등록 검증을 명시한다', () => {
    const cfg = getSourcesForCategory({ sectorSlug: 'auto' })
    expect(cfg.priceLabel).toBe('정비 단가')
    expect(cfg.methodology.some(m => m.includes('자동차관리법'))).toBe(true)
  })

  it('음식 sector 는 식품위생법 영업신고 + 위생등급제 출처를 포함한다', () => {
    const cfg = getSourcesForCategory({ sectorSlug: 'food' })
    expect(cfg.priceLabel).toBe('대표 메뉴 가격')
    expect(cfg.sources.some(s => s.name === '식품의약품안전처')).toBe(true)
  })

  it('교육 sector 는 학원법 등록 검증과 시·도 교육청 출처를 포함한다', () => {
    const cfg = getSourcesForCategory({ sectorSlug: 'education' })
    expect(cfg.priceLabel).toBe('월 수강료')
    expect(cfg.sources.some(s => s.name === '시·도 교육청')).toBe(true)
    expect(cfg.methodology.some(m => m.includes('학원법'))).toBe(true)
  })

  it('전문서비스 sector 는 변호사법·세무사법 광고 규제 고지가 들어간다', () => {
    const cfg = getSourcesForCategory({ sectorSlug: 'professional' })
    expect(cfg.priceLabel).toBe('기본 견적')
    expect(cfg.methodology.some(m => m.includes('변호사법') || m.includes('세무사법'))).toBe(true)
  })

  it('알 수 없는 sector 는 base 로 폴백한다 (override 미정의)', () => {
    const cfg = getSourcesForCategory({ sectorSlug: 'nonexistent-sector' })
    expect(cfg.priceLabel).toBe('기본 단가')
    expect(cfg.sources.some(s => s.name === '네이버 플레이스')).toBe(true)
  })

  it('모든 sector 의 priceLabel 은 비어있지 않다', () => {
    const sectors = ['medical', 'beauty', 'living', 'auto', 'food', 'education', 'professional', 'pet', 'wedding', 'leisure']
    for (const slug of sectors) {
      const cfg = getSourcesForCategory({ sectorSlug: slug })
      expect(cfg.priceLabel.trim().length).toBeGreaterThan(0)
      expect(cfg.methodology.length).toBeGreaterThan(0)
      expect(cfg.sources.length).toBeGreaterThan(0)
    }
  })
})
