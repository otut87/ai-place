import type { MetadataRoute } from 'next'
import { generateSitemapEntries } from '@/lib/seo'

const BASE_URL = 'https://ai-place.vercel.app'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries = await generateSitemapEntries(BASE_URL)

  return entries.map(entry => ({
    url: entry.url,
    lastModified: entry.lastModified,
    changeFrequency: entry.changeFrequency,
    priority: entry.priority,
  }))
}
