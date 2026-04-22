// T-195 — 썸네일 프롬프트 빌더 (gpt-image-2 low).
//
// 설계 원칙:
//  - 썸네일은 글 내용을 함축한 "순수 일러스트" — 이미지 안에 텍스트 렌더 금지.
//    (제목은 블로그 페이지 HTML 에 별도 표시되므로 이미지에 또 넣을 이유 없음.
//     이미지 내 텍스트는 SEO/접근성 마이너스이고 gpt-image-2 리소스 낭비.)
//  - summary + highlights 가 일러스트의 **의미 앵커** — 글마다 다른 그림이 나오도록.
//  - sector motif·palette·angle tone 은 **보조 가이드**로 뒤에 배치.
//  - alt 속성은 image-generator 가 title 로 설정 (접근성).

import type { AngleKey } from '@/lib/blog/keyword-generator'

export interface ThumbnailPromptInput {
  /** 글의 한 줄 요약 (Direct Answer Block, 50~80자) — 일러스트의 의미 앵커. */
  summary: string
  /**
   * 숫자/사실 훅 1~3개. 예:
   *   ["리뷰 412건 자체 분석", "평균 평점 4.7", "전문의 2인 이상"]
   * 모델이 이 중 1~2개를 비주얼 메타포로 녹여냄.
   */
  highlights?: string[]
  categoryName: string
  cityName: string
  /** medical/beauty/living/auto/education/professional/pet/food/wedding/leisure. */
  sector: string
  angle: AngleKey
}

/** 10 sector → 비주얼 모티브 + 컬러 팔레트. */
const SECTOR_MOTIFS: Record<string, { motif: string; palette: string }> = {
  medical: {
    motif: 'clinical-but-warm objects — stethoscope, medical cross, chart, or pill bottle metaphor',
    palette: 'cool mint + soft white base, single navy accent',
  },
  beauty: {
    motif: 'beauty tools or care gestures — scissors, brush, mirror, skincare bottle, or hand-care metaphor',
    palette: 'blush pink + cream base, single rose-gold accent',
  },
  living: {
    motif: 'home and living — house outline, interior furniture, key, or service hand-off',
    palette: 'warm beige + sage green base, single terracotta accent',
  },
  auto: {
    motif: 'automotive — car silhouette, wrench, gear, steering wheel, or open road',
    palette: 'steel gray + off-white base, single warm orange accent',
  },
  education: {
    motif: 'learning — open book, pencil, chalkboard, notebook, or graduation cap',
    palette: 'deep navy + cream base, single mustard accent',
  },
  professional: {
    motif: 'professional services — document, scale, briefcase, folder, or abstract consulting gesture',
    palette: 'charcoal + warm ivory base, single muted gold accent',
  },
  pet: {
    motif: 'pet care — paw print, pet silhouette, leash, or food bowl',
    palette: 'peach + cream base, single dusty teal accent',
  },
  food: {
    motif: 'food & dining — plate, fork-and-knife, fresh ingredient, or serving gesture',
    palette: 'warm terracotta + cream base, single olive green accent',
  },
  wedding: {
    motif: 'wedding — ring, bouquet, arch, cake, or celebratory element',
    palette: 'soft blush + ivory base, single champagne gold accent',
  },
  leisure: {
    motif: 'leisure & activity — sport equipment, yoga pose element, racket, or outdoor gear',
    palette: 'sky blue + cream base, single fresh green accent',
  },
}

/** 6 angle → 일러스트 구도/컨셉 힌트. */
const ANGLE_TONES: Record<AngleKey, string> = {
  'review-deepdive':
    'careful analysis of many reviews — stacked cards or pages, sorted fragments, a magnifying metaphor, or a balanced scale weighing voices',
  'price-transparency':
    'transparency of costs — clean bar/line chart metaphor, stacked coin or receipt shapes, or a labeled price tag',
  'procedure-guide':
    'step-by-step journey — numbered stepping stones, arrows flowing left-to-right, or a staircase path',
  'first-visit':
    'warm first-time welcome — open door, arrow pointing inward, map pin to a destination, or a first-step gesture',
  'comparison-context':
    'side-by-side comparison — center-split composition, two balanced objects, or a scale/balance metaphor',
  'seasonal':
    'subtle seasonal accent relevant to now — cherry blossom / autumn leaf / snowflake / sunbeam — layered over the main motif',
}

const BRAND_LOCK = [
  'Brand style lock (AI Place editorial):',
  '- Single focal illustration that directly communicates the summary above.',
  '- Flat vector style, no photorealism, no heavy gradients.',
  '- Pastel base per palette, exactly one accent color.',
  '- Centered composition with generous margins; nothing touches the edges.',
  '- 1024x1024 square canvas.',
].join('\n')

const NEGATIVE = [
  'Strictly avoid:',
  '- ANY text, letters, numbers, words, or characters — no Korean, no English, no digits, no labels, no captions, no watermarks. Pure illustration only.',
  '- real brand logos, real storefronts, real signage, real product packaging',
  '- humans — no people, faces, hands, body parts, or human silhouettes',
  '- cartoon mascots, anime style, emoji, clip-art look',
  '- stock photo overlays, UI chrome, borders, frames',
  '- cluttered pattern backgrounds or multiple competing focal points',
].join('\n')

/** gpt-image-2 low 최종 프롬프트. */
export function buildThumbnailPrompt(input: ThumbnailPromptInput): string {
  const motif = SECTOR_MOTIFS[input.sector] ?? SECTOR_MOTIFS.living
  const tone = ANGLE_TONES[input.angle] ?? ANGLE_TONES['review-deepdive']
  const highlights = (input.highlights ?? []).filter(Boolean).slice(0, 3)

  const sections: string[] = []

  sections.push(
    `Pure illustration blog thumbnail — no text of any kind in the image. Visualize the SPECIFIC content of this post.`,
  )

  sections.push('')
  sections.push(`## What the post is about (the anchor for the illustration)`)
  sections.push(`Summary: "${input.summary}"`)
  if (highlights.length > 0) {
    sections.push('Key hooks to fold into the visual metaphor (pick one or two):')
    for (const h of highlights) sections.push(`- ${h}`)
  }

  sections.push('')
  sections.push(`## Illustration concept`)
  sections.push(`Angle: ${input.angle} — ${tone}.`)
  sections.push(
    `The illustration should feel specific to THIS article — it must not be interchangeable with a generic ${input.sector} cover. Let the summary and hooks drive the visual choice.`,
  )

  sections.push('')
  sections.push(`## Context cues (secondary guides — do not override the summary)`)
  sections.push(`Category: ${input.categoryName} in ${input.cityName}.`)
  sections.push(`Motif reference: ${motif.motif}.`)
  sections.push(`Palette: ${motif.palette}.`)

  sections.push('')
  sections.push(BRAND_LOCK)

  sections.push('')
  sections.push(NEGATIVE)

  return sections.join('\n')
}

/** 테스트·디버그용. */
export const __promptParts = {
  SECTOR_MOTIFS,
  ANGLE_TONES,
  BRAND_LOCK,
  NEGATIVE,
}
