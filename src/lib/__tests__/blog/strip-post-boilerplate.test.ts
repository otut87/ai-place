// T-253 — stripPostBoilerplate 단위 검증.
// 콘텐츠 파이프라인이 markdown 본문에 박은 FAQ/통계/관련업체/타깃검색어 strip.
// page detail 은 faqs/statistics 컬럼을 별도 컴포넌트로 그리므로 본문 중복 제거 필수.

import { describe, it, expect } from 'vitest'
import { stripPostBoilerplate } from '@/lib/blog/markdown'

describe('stripPostBoilerplate', () => {
  it('hasFaqs 면 ## 자주 묻는 질문 섹션 통째로 제거 (다음 H2 까지)', () => {
    const md = [
      '## 결론',
      '본문 1',
      '',
      '## 자주 묻는 질문',
      '### Q1',
      '답변 1',
      '### Q2',
      '답변 2',
      '',
      '## 다음 섹션',
      '본문 2',
    ].join('\n')

    const out = stripPostBoilerplate(md, { hasFaqs: true, hasStatistics: false })
    expect(out).not.toContain('자주 묻는 질문')
    expect(out).not.toContain('Q1')
    expect(out).not.toContain('답변 1')
    expect(out).toContain('## 결론')
    expect(out).toContain('## 다음 섹션')
    expect(out).toContain('본문 2')
  })

  it('hasFaqs=false 면 ## 자주 묻는 질문 섹션 보존 (DB faqs 가 비어있을 때 fallback 노출용)', () => {
    const md = [
      '## 자주 묻는 질문',
      '### Q1',
      '답변',
      '## 다음',
    ].join('\n')
    const out = stripPostBoilerplate(md, { hasFaqs: false, hasStatistics: false })
    expect(out).toContain('## 자주 묻는 질문')
    expect(out).toContain('답변')
  })

  it('hasStatistics 면 ## 핵심 통계 와 ## 통계 둘 다 제거', () => {
    const md = [
      '## 핵심 통계',
      '- 통계 1',
      '## 결론',
      '본문',
      '## 통계',
      '- 통계 2',
      '## FAQ', // FAQ 는 hasFaqs=false 라 보존
      '내용',
    ].join('\n')

    const out = stripPostBoilerplate(md, { hasFaqs: false, hasStatistics: true })
    expect(out).not.toContain('통계 1')
    expect(out).not.toContain('통계 2')
    expect(out).toContain('## 결론')
    expect(out).toContain('## FAQ')
  })

  it('## 관련 업체 / ## 관련업체 는 항상 strip (aside-card 가 canonical)', () => {
    const md = [
      '## 결론',
      '본문',
      '## 관련 업체',
      '연결된 업체: cleanhue, alive-skin',
      '',
      '## 관련업체',
      '추가 슬러그',
    ].join('\n')

    const out = stripPostBoilerplate(md, { hasFaqs: false, hasStatistics: false })
    expect(out).toContain('## 결론')
    expect(out).not.toContain('cleanhue')
    expect(out).not.toContain('alive-skin')
    expect(out).not.toContain('관련 업체')
    expect(out).not.toContain('관련업체')
  })

  it('**타깃 검색어**: ... 한 줄 strip (내부 SEO 메타 노출 방지)', () => {
    const md = [
      '# 제목',
      '',
      '> 요약',
      '',
      '**타깃 검색어**: 천안 여드름 피부과 추천',
      '',
      '## 본문',
      '내용',
    ].join('\n')

    const out = stripPostBoilerplate(md, { hasFaqs: false, hasStatistics: false })
    expect(out).not.toContain('타깃 검색어')
    expect(out).not.toContain('천안 여드름 피부과 추천')
    expect(out).toContain('## 본문')
  })

  it('※ 참고 업체 A·B placeholder 라인 strip', () => {
    const md = [
      '| 항목 | A | B |',
      '※ 참고 업체 A·B는 이번 분석 대상에 포함된 업체가 없어 해당 없음으로 처리합니다.',
      '## 다음',
    ].join('\n')

    const out = stripPostBoilerplate(md, { hasFaqs: false, hasStatistics: false })
    expect(out).not.toContain('해당 없음으로 처리')
    expect(out).toContain('## 다음')
  })

  it('FAQ section 뒤에 H2 가 없으면 EOF 까지 strip', () => {
    const md = [
      '## 결론',
      '본문',
      '## 자주 묻는 질문',
      '### Q1',
      '답변 1',
      '### Q2',
      '답변 2',
    ].join('\n')

    const out = stripPostBoilerplate(md, { hasFaqs: true, hasStatistics: false })
    expect(out).toContain('## 결론')
    expect(out).toContain('본문')
    expect(out).not.toContain('자주 묻는 질문')
    expect(out).not.toContain('답변 1')
    // 끝부분 빈 줄 정리 — 마지막에 빈 줄 폭주 없음
    expect(out.endsWith('본문')).toBe(true)
  })

  it('빈 입력 → 빈 출력', () => {
    expect(stripPostBoilerplate('', { hasFaqs: true, hasStatistics: true })).toBe('')
  })

  it('strip 대상 없는 일반 본문은 그대로 통과', () => {
    const md = '## 분석\n\n본문\n\n## 결론\n\n끝'
    const out = stripPostBoilerplate(md, { hasFaqs: true, hasStatistics: true })
    expect(out).toBe(md)
  })

  it('"참고 업체 A·B" placeholder 컬럼이 든 비교표는 통째로 strip', () => {
    const md = [
      '## 비교표',
      '',
      '| 항목 | 맘에든 | 참고 업체 A | 참고 업체 B |',
      '|---|---|---|---|',
      '| 위치 | 천안 서북구 | 정보 없음 | 정보 없음 |',
      '| 평점 | 5.0점 | — | — |',
      '',
      '## 다음',
      '본문',
    ].join('\n')

    const out = stripPostBoilerplate(md, { hasFaqs: false, hasStatistics: false })
    expect(out).toContain('## 비교표')
    expect(out).toContain('## 다음')
    expect(out).not.toContain('참고 업체 A')
    expect(out).not.toContain('참고 업체 B')
    expect(out).not.toContain('정보 없음')
    expect(out).not.toContain('5.0점')
    expect(out).not.toContain('| 위치')
  })

  it('placeholder 가 없는 정상 비교표는 보존', () => {
    const md = [
      '## 비교표',
      '',
      '| 항목 | 닥터에버스 | 클린휴 |',
      '|---|---|---|',
      '| 평점 | 5.0 | 4.3 |',
      '',
      '## 다음',
    ].join('\n')

    const out = stripPostBoilerplate(md, { hasFaqs: false, hasStatistics: false })
    expect(out).toContain('| 항목 | 닥터에버스 | 클린휴 |')
    expect(out).toContain('| 평점 | 5.0 | 4.3 |')
  })

  it('실제 cheonan-dermatology-acne 패턴: 핵심 통계 + 자주 묻는 질문 + 관련 업체 동시 strip', () => {
    const md = [
      '# 천안 여드름 피부과 추천',
      '',
      '> 요약',
      '',
      '**타깃 검색어**: 천안 여드름 피부과 추천',
      '',
      '## 핵심 통계',
      '- 평균 비용: 5~15만원',
      '',
      '## 자주 묻는 질문',
      '### Q',
      '답변',
      '',
      '## 관련 업체',
      '연결된 업체: cleanhue, alive-skin',
    ].join('\n')

    const out = stripPostBoilerplate(md, { hasFaqs: true, hasStatistics: true })
    expect(out).toContain('# 천안 여드름 피부과 추천')
    expect(out).toContain('> 요약')
    expect(out).not.toContain('타깃 검색어')
    expect(out).not.toContain('핵심 통계')
    expect(out).not.toContain('자주 묻는 질문')
    expect(out).not.toContain('관련 업체')
    expect(out).not.toContain('cleanhue')
    expect(out).not.toContain('5~15만원')
  })
})
