// T-144 — 코드 스니펫 생성기 테스트.
import { describe, it, expect } from 'vitest'
import { generateFixSnippet, buildFixSnippetMap } from '@/lib/diagnostic/fix-snippets'
import type { CheckResult, CheckId } from '@/lib/diagnostic/scan-site'

function mk(id: CheckId, status: 'pass' | 'warn' | 'fail' = 'fail'): CheckResult {
  return {
    id, label: id, category: 'geo', status,
    points: status === 'pass' ? 10 : 0, maxPoints: 10,
  }
}

describe('generateFixSnippet', () => {
  it('pass 체크 → null (수정 불필요)', () => {
    expect(generateFixSnippet(mk('faq_schema', 'pass'))).toBeNull()
  })

  it('fail 체크 → 스니펫 반환', () => {
    const snip = generateFixSnippet(mk('faq_schema'))
    expect(snip).not.toBeNull()
    expect(snip!.lang).toBe('html')
    expect(snip!.code).toContain('FAQPage')
    expect(snip!.placement).toBeTruthy()
  })

  it('13개 체크 모두 fail 시 스니펫 존재 (최소 11개)', () => {
    const ids: CheckId[] = [
      'jsonld_localbusiness', 'robots_ai_allow', 'faq_schema', 'review_schema',
      'direct_answer_block', 'sameas_entity_linking', 'last_updated',
      'title', 'meta_description', 'sitemap', 'llms_txt', 'https', 'viewport',
    ]
    const count = ids.filter(id => generateFixSnippet(mk(id)) !== null).length
    expect(count).toBeGreaterThanOrEqual(11)
  })

  it('JSON-LD 스니펫은 @context + @type 포함', () => {
    const snip = generateFixSnippet(mk('jsonld_localbusiness'))!
    expect(snip.code).toContain('@context')
    expect(snip.code).toContain('@type')
    expect(snip.code).toContain('aggregateRating')
    expect(snip.code).toContain('sameAs')
  })

  it('FAQ 스니펫은 5개 이상 Q&A', () => {
    const snip = generateFixSnippet(mk('faq_schema'))!
    const qMatches = (snip.code.match(/"@type":\s*"Question"/g) ?? []).length
    expect(qMatches).toBeGreaterThanOrEqual(5)
  })

  it('robots.txt 스니펫은 AI 봇 7종 모두 포함', () => {
    const snip = generateFixSnippet(mk('robots_ai_allow'))!
    for (const bot of ['GPTBot', 'ClaudeBot', 'Claude-User', 'Claude-SearchBot', 'PerplexityBot', 'OAI-SearchBot', 'Google-Extended']) {
      expect(snip.code).toContain(bot)
    }
  })

  it('sameAs 스니펫은 naver·kakao·google 모두 포함', () => {
    const snip = generateFixSnippet(mk('sameas_entity_linking'))!
    expect(snip.code).toContain('naver')
    expect(snip.code).toContain('kakao')
    expect(snip.code).toContain('google')
  })

  it('review_schema 스니펫은 저작권 주의사항 note', () => {
    const snip = generateFixSnippet(mk('review_schema'))!
    expect(snip.note).toContain('저작권')
  })

  it('Direct Answer 스니펫은 H2 + p 구조', () => {
    const snip = generateFixSnippet(mk('direct_answer_block'))!
    expect(snip.code).toContain('<h2>')
    expect(snip.code).toContain('<p>')
  })

  it('Last Updated 스니펫은 time datetime 포함', () => {
    const snip = generateFixSnippet(mk('last_updated'))!
    expect(snip.code).toContain('<time datetime=')
    expect(snip.code).toContain('dateModified')
  })

  it('title 스니펫은 <title> 태그', () => {
    const snip = generateFixSnippet(mk('title'))!
    expect(snip.code).toMatch(/<title>.*<\/title>/)
  })
})

describe('buildFixSnippetMap', () => {
  it('fail 체크만 맵에 포함 (pass 제외)', () => {
    const checks: CheckResult[] = [
      mk('faq_schema', 'fail'),
      mk('https', 'pass'),
      mk('sameas_entity_linking', 'warn'),
    ]
    const map = buildFixSnippetMap(checks)
    expect(map.has('faq_schema')).toBe(true)
    expect(map.has('https')).toBe(false)        // pass 제외
    expect(map.has('sameas_entity_linking')).toBe(true)  // warn 포함
  })

  it('빈 배열 → 빈 맵', () => {
    expect(buildFixSnippetMap([]).size).toBe(0)
  })
})
