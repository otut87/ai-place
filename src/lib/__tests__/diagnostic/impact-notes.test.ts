// T-147 — 영향도 수치화 테스트.
import { describe, it, expect } from 'vitest'
import { getImpactNote } from '@/lib/diagnostic/impact-notes'
import type { CheckId } from '@/lib/diagnostic/scan-site'

describe('getImpactNote', () => {
  it('모든 CheckId 에 대해 영향 노트 존재', () => {
    const ids: CheckId[] = [
      'jsonld_localbusiness', 'robots_ai_allow', 'faq_schema', 'review_schema',
      'breadcrumb_schema', 'direct_answer_block', 'sameas_entity_linking',
      'last_updated', 'time_markup', 'author_person_schema',
      'title', 'meta_description', 'sitemap', 'llms_txt', 'https', 'viewport',
    ]
    for (const id of ids) {
      const note = getImpactNote(id)
      expect(note, `${id} 영향 노트 없음`).not.toBeNull()
      expect(note!.expectedEffect).toBeTruthy()
      expect(note!.source).toBeTruthy()
    }
  })

  it('FAQ 는 2.7~3.2배 수치 포함', () => {
    const n = getImpactNote('faq_schema')!
    expect(n.expectedEffect).toMatch(/2\.7|3\.2/)
  })

  it('Last Updated 는 90일·2.3배 수치 포함', () => {
    const n = getImpactNote('last_updated')!
    expect(n.expectedEffect).toMatch(/90일|2\.3/)
  })
})
