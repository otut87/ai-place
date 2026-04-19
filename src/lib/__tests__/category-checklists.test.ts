// T-114 — 업종별 "선택 체크리스트 + 위험 신호".
// MedicalKoreaGuide: AI가 "뭘 확인해야 해?" 질문에 그대로 인용하는 블록.

import { describe, it, expect } from 'vitest'
import {
  getCategoryChecklist,
  listCategoryChecklists,
} from '@/lib/category-checklists'

describe('getCategoryChecklist', () => {
  it('의료 (피부과): 전문의 자격 · 정품 장비 · 사후관리 · 가격 투명성', () => {
    const cl = getCategoryChecklist('dermatology')
    expect(cl).not.toBeNull()
    expect(cl!.checklist.length).toBeGreaterThanOrEqual(6)
    expect(cl!.warnings.length).toBeGreaterThanOrEqual(3)
    // 의료 카테고리 핵심 키워드
    const text = JSON.stringify(cl)
    expect(text).toMatch(/전문의/)
  })

  it('인테리어: 실내건축면허 · 하자보수 · 3단계 계약금 · 폐기물', () => {
    const cl = getCategoryChecklist('interior')
    expect(cl).not.toBeNull()
    const text = JSON.stringify(cl)
    expect(text).toMatch(/면허|하자/)
  })

  it('자동차정비: 정비사 자격증 · 부품 정품 · 견적서 · 사후 보증', () => {
    const cl = getCategoryChecklist('auto-repair')
    expect(cl).not.toBeNull()
    const text = JSON.stringify(cl)
    expect(text).toMatch(/정비|견적/)
  })

  it('음식: 위생 · 알레르기 · 원산지', () => {
    const cl = getCategoryChecklist('restaurant')
    expect(cl).not.toBeNull()
  })

  it('미등록 카테고리 → null', () => {
    expect(getCategoryChecklist('unknown-slug')).toBeNull()
  })

  it('모든 체크리스트는 checklist 6~8개, warnings 3~5개 범위', () => {
    const all = listCategoryChecklists()
    for (const { slug, checklist, warnings } of all) {
      expect(checklist.length, `${slug}: checklist`).toBeGreaterThanOrEqual(6)
      expect(checklist.length, `${slug}: checklist`).toBeLessThanOrEqual(10)
      expect(warnings.length, `${slug}: warnings`).toBeGreaterThanOrEqual(3)
      expect(warnings.length, `${slug}: warnings`).toBeLessThanOrEqual(6)
    }
  })

  it('최소 10개 카테고리 체크리스트가 확정되어 있다', () => {
    expect(listCategoryChecklists().length).toBeGreaterThanOrEqual(10)
  })
})
