// T-096 — title 중복 제거 유틸.
// layout.tsx 의 `template: "%s | AI Place"` 와 개별 페이지의 `title: "... | AI Place"`
// 가 겹쳐 "... | AI Place | AI Place" 중복을 일으킴.
// composePageTitle(raw) 는 접미사가 이미 붙은 경우 제거해서 1회만 부착되도록 보장한다.

import { describe, it, expect } from 'vitest'
import { composePageTitle, SITE_TITLE_SUFFIX } from '@/lib/seo/compose-title'

describe('composePageTitle', () => {
  it('접미사가 없는 문자열은 그대로 반환한다 (layout template 이 붙인다)', () => {
    expect(composePageTitle('천안 피부과')).toBe('천안 피부과')
  })

  it('접미사가 이미 붙어있으면 제거한다', () => {
    expect(composePageTitle('천안 피부과 | AI Place')).toBe('천안 피부과')
  })

  it('접미사 앞뒤 공백이 있어도 제거한다', () => {
    expect(composePageTitle('천안 피부과  |  AI Place')).toBe('천안 피부과')
    expect(composePageTitle('천안 피부과 | AI Place ')).toBe('천안 피부과')
  })

  it('빈 문자열은 기본 문구를 반환한다', () => {
    expect(composePageTitle('')).toBe('AI Place')
    expect(composePageTitle(undefined)).toBe('AI Place')
  })

  it('접미사 중복 부착을 감지하고 1개만 남긴다', () => {
    expect(composePageTitle('천안 | AI Place | AI Place')).toBe('천안')
  })

  it('"AI Place — ..." 같은 접두사 형태는 그대로 유지한다 (접두사는 접미사가 아님)', () => {
    expect(composePageTitle('AI Place 소개 — 이지수 큐레이터')).toBe('AI Place 소개 — 이지수 큐레이터')
  })

  it('상수 SITE_TITLE_SUFFIX 는 "| AI Place" 여야 한다', () => {
    expect(SITE_TITLE_SUFFIX).toBe('| AI Place')
  })
})
