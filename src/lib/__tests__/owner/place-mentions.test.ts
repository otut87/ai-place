import { describe, it, expect } from 'vitest'
import {
  buildPlacePath,
  buildBlogPath,
  normalizeBlogPostMentionType,
} from '@/lib/owner/place-mentions'

describe('place-mentions URL builders', () => {
  it('buildPlacePath — /[city]/[category]/[slug]', () => {
    expect(buildPlacePath('cheonan', 'dermatology', 'doctor-evers'))
      .toBe('/cheonan/dermatology/doctor-evers')
  })

  it('buildBlogPath — /blog/[city]/[sector]/[slug]', () => {
    expect(buildBlogPath('cheonan', 'medical', 'acne-treatment-guide'))
      .toBe('/blog/cheonan/medical/acne-treatment-guide')
  })

  it('normalizeBlogPostMentionType → blog', () => {
    expect(normalizeBlogPostMentionType()).toBe('blog')
  })
})
