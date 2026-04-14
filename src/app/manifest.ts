import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'AI Place',
    short_name: 'AI Place',
    description: 'AI가 추천하는 우리 동네 업체',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#00a67c',
    icons: [
      {
        src: '/favicon.ico',
        sizes: 'any',
        type: 'image/x-icon',
      },
    ],
  }
}
