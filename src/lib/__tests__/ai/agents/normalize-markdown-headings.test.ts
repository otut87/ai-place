// T-195 — writer.ts 의 LLM 응답 markdown 후처리 normalizer 단위 테스트.
//   1) 본문 H1 제거 (페이지 H1 중복 방지의 1차 방어선)
//   2) 최얕은 헤딩이 H3+ 면 H2 로 일괄 승격 — LLM 이 시스템 프롬프트의 H2 지시를
//      무시하고 H3 부터 시작하는 경우 자동 보정.

import { describe, it, expect } from 'vitest'
import { normalizeMarkdownHeadings } from '@/lib/ai/agents/writer'

describe('normalizeMarkdownHeadings', () => {
  it('LLM 이 H2 부터 시작한 정상 출력은 그대로 보존된다', () => {
    const md = '## 결론\n본문\n\n## 분석 방법\n본문\n\n### 세부'
    expect(normalizeMarkdownHeadings(md)).toBe(md)
  })

  it('LLM 이 H3 부터 시작하는 잘못된 출력은 H2 로 승격된다 (라이브 회귀 케이스)', () => {
    const md = '### 결론\n본문\n\n### 분석 방법\n본문\n\n#### 업체'
    const out = normalizeMarkdownHeadings(md)
    expect(out).toBe('## 결론\n본문\n\n## 분석 방법\n본문\n\n### 업체')
  })

  it('LLM 이 H1 을 출력해도 본문에서 제거된다 (페이지가 별도 H1 렌더)', () => {
    const md = '# 글 제목\n\n## 결론\n본문'
    const out = normalizeMarkdownHeadings(md)
    expect(out).not.toContain('# 글 제목')
    expect(out).toContain('## 결론')
  })

  it('H1 만 있고 H2 이상이 없으면 H1 만 제거하고 추가 변경 없음', () => {
    const md = '# 제목\n\n본문 문단만'
    const out = normalizeMarkdownHeadings(md)
    expect(out).not.toContain('#')
    expect(out).toContain('본문 문단만')
  })

  it('헤딩이 전혀 없으면 원본 그대로', () => {
    const md = '본문 문단\n\n- 리스트'
    expect(normalizeMarkdownHeadings(md)).toBe(md)
  })

  it('코드블록 안의 # 은 헤딩으로 인식되지 않고 보존된다', () => {
    const md = [
      '### 결론',
      '',
      '```bash',
      '# 이건 셸 주석이지 헤딩이 아님',
      '## 이것도',
      '```',
      '',
      '### 다음 섹션',
    ].join('\n')
    const out = normalizeMarkdownHeadings(md)
    expect(out).toContain('## 결론')
    expect(out).toContain('## 다음 섹션')
    expect(out).toContain('# 이건 셸 주석이지 헤딩이 아님')
    expect(out).toContain('## 이것도')
  })

  it('H1 + H3 + H4 혼합 — H1 제거 + 최얕음 H3 → H2 로 한 단계 승격', () => {
    const md = '# 글 제목\n\n### 섹션\n\n#### 하위'
    const out = normalizeMarkdownHeadings(md)
    expect(out).not.toContain('# 글 제목')
    expect(out).toContain('## 섹션')
    expect(out).toContain('### 하위')
  })

  it('최얕음이 이미 H2 라면 더 깊은 헤딩(H4 등)도 그대로 유지', () => {
    const md = '## 섹션\n\n#### 매우 깊음'
    expect(normalizeMarkdownHeadings(md)).toBe(md)
  })
})
