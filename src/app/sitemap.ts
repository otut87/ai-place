import type { MetadataRoute } from 'next'
import { generateSitemapEntries } from '@/lib/seo'

const BASE_URL = 'https://aiplace.kr'

// ISR — 1시간마다 자동 재생성. 블로그 발행/수정 액션의
// revalidatePath('/sitemap.xml') 로 on-demand 갱신도 함께 작동.
export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries = await generateSitemapEntries(BASE_URL)

  return entries.map(entry => ({
    url: entry.url,
    lastModified: entry.lastModified,
    changeFrequency: entry.changeFrequency,
    priority: entry.priority,
  }))
}
