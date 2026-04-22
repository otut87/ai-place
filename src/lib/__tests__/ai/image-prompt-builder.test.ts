// T-195 — 썸네일 프롬프트 빌더 테스트.
import { describe, it, expect } from 'vitest'
import { buildThumbnailPrompt, __promptParts } from '@/lib/ai/image-prompt-builder'

describe('buildThumbnailPrompt', () => {
  const base = {
    summary: '천안에서 여드름 치료로 만족도가 높은 피부과 3곳을 추천합니다.',
    highlights: ['리뷰 412건', '평균 평점 4.7', '전문의 2인 이상'],
    categoryName: '피부과',
    cityName: '천안',
    sector: 'medical',
    angle: 'review-deepdive' as const,
  }

  it('summary + highlights 가 프롬프트에 포함된다', () => {
    const p = buildThumbnailPrompt(base)
    expect(p).toContain(base.summary)
    for (const h of base.highlights) expect(p).toContain(h)
  })

  it('이미지 내 텍스트 금지 네거티브 포함', () => {
    const p = buildThumbnailPrompt(base)
    expect(p).toMatch(/ANY text.*Pure illustration only/)
  })

  it('제목(title) 필드가 타입에서 제거됨 (이미지 텍스트 정책)', () => {
    // 컴파일 타임 검증 — buildThumbnailPrompt 는 title 을 입력으로 받지 않는다.
    // @ts-expect-error title 은 더 이상 허용되지 않음
    const _ = buildThumbnailPrompt({ ...base, title: 'x' })
    void _
  })

  it('sector 모티브 반영 (medical → mint/navy)', () => {
    const p = buildThumbnailPrompt(base)
    expect(p).toContain('mint')
  })

  it('알 수 없는 sector 는 living 로 fallback', () => {
    const p = buildThumbnailPrompt({ ...base, sector: 'unknown' })
    expect(p).toContain('sage green')   // living palette
  })

  it('6 angle 전부 ANGLE_TONES 정의 존재', () => {
    const angles = Object.keys(__promptParts.ANGLE_TONES)
    expect(angles.length).toBe(6)
    for (const a of angles) {
      expect(__promptParts.ANGLE_TONES[a as keyof typeof __promptParts.ANGLE_TONES]).toBeTruthy()
    }
  })

  it('10 sector 전부 SECTOR_MOTIFS 정의 존재', () => {
    expect(Object.keys(__promptParts.SECTOR_MOTIFS).length).toBe(10)
  })

  it('highlights 미지정 시에도 동작 + summary 기반 프롬프트 생성', () => {
    const p = buildThumbnailPrompt({ ...base, highlights: undefined })
    expect(p).toContain(base.summary)
    expect(p.length).toBeGreaterThan(500)
  })
})
