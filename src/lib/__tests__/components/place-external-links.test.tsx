/**
 * Phase 11 — PlaceExternalLinks
 * 6종 외부 링크 슬롯: Naver Place / KakaoMap / Google Maps / 홈페이지 / 블로그 / Instagram.
 * 데이터가 있는 슬롯만 렌더. 모두 rel="noopener noreferrer nofollow".
 */
import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { PlaceExternalLinks } from '@/components/business/place-external-links'

function render(props: React.ComponentProps<typeof PlaceExternalLinks>) {
  return renderToStaticMarkup(createElement(PlaceExternalLinks, props))
}

describe('PlaceExternalLinks', () => {
  it('아무 링크도 없으면 null 반환', () => {
    const html = render({ place: {} })
    expect(html).toBe('')
  })

  it('제공된 링크 슬롯만 렌더 (6종 중 3종 입력)', () => {
    const html = render({
      place: {
        naverPlaceUrl: 'https://naver.me/x',
        kakaoMapUrl: 'https://place.map.kakao.com/1',
        homepageUrl: 'https://example.com',
      },
    })
    expect(html).toContain('Naver Place')
    expect(html).toContain('KakaoMap')
    expect(html).toContain('홈페이지')
    expect(html).not.toContain('Google Maps')
    expect(html).not.toContain('블로그')
    expect(html).not.toContain('Instagram')
  })

  it('6종 모두 있으면 6종 모두 렌더', () => {
    const html = render({
      place: {
        naverPlaceUrl: 'https://naver.me/x',
        kakaoMapUrl: 'https://place.map.kakao.com/1',
        googleBusinessUrl: 'https://maps.google.com/x',
        homepageUrl: 'https://example.com',
        blogUrl: 'https://blog.example.com',
        instagramUrl: 'https://instagram.com/x',
      },
    })
    expect(html).toContain('Naver Place')
    expect(html).toContain('KakaoMap')
    expect(html).toContain('Google Maps')
    expect(html).toContain('홈페이지')
    expect(html).toContain('블로그')
    expect(html).toContain('Instagram')
  })

  it('모든 링크에 target="_blank" + rel="noopener noreferrer nofollow"', () => {
    const html = render({
      place: {
        naverPlaceUrl: 'https://naver.me/x',
        homepageUrl: 'https://example.com',
      },
    })
    const anchorMatches = html.match(/<a[^>]+>/g) ?? []
    expect(anchorMatches.length).toBeGreaterThanOrEqual(2)
    for (const a of anchorMatches) {
      expect(a).toContain('target="_blank"')
      expect(a).toContain('rel="noopener noreferrer nofollow"')
    }
  })

  it('variant="inline" 은 inline 스타일(<li> + 파랑 링크 텍스트)로 렌더', () => {
    const html = render({
      variant: 'inline',
      place: { naverPlaceUrl: 'https://naver.me/x' },
    })
    expect(html).toContain('Naver Place')
    expect(html).toContain('<li>')
  })
})
