import { describe, it, expect } from 'vitest'
import { identifyBot, parseLocalPath, AI_BOT_PATTERNS } from '@/lib/seo/bot-detection'

describe('identifyBot', () => {
  it('GPTBot', () => {
    expect(identifyBot('Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.0; +https://openai.com/gptbot)')?.id).toBe('gptbot')
  })

  it('ClaudeBot', () => {
    expect(identifyBot('ClaudeBot/1.0')?.id).toBe('claudebot')
  })

  it('PerplexityBot', () => {
    expect(identifyBot('PerplexityBot/1.0')?.id).toBe('perplexitybot')
  })

  it('CCBot', () => {
    expect(identifyBot('CCBot/2.0')?.id).toBe('ccbot')
  })

  it('Google-Extended', () => {
    expect(identifyBot('Mozilla/5.0 Google-Extended')?.id).toBe('google-extended')
  })

  it('대소문자 무관', () => {
    expect(identifyBot('gptbot/1.0')?.id).toBe('gptbot')
  })

  it('일반 브라우저 → null', () => {
    expect(identifyBot('Mozilla/5.0 (X11; Linux x86_64) Chrome/120.0')).toBeNull()
  })

  it('null/undefined → null', () => {
    expect(identifyBot(null)).toBeNull()
    expect(identifyBot(undefined)).toBeNull()
    expect(identifyBot('')).toBeNull()
  })

  it('AI_BOT_PATTERNS 15종 이상', () => {
    expect(AI_BOT_PATTERNS.length).toBeGreaterThanOrEqual(15)
  })
})

describe('parseLocalPath', () => {
  it('/cheonan/dermatology/doctor-evers', () => {
    expect(parseLocalPath('/cheonan/dermatology/doctor-evers')).toEqual({
      city: 'cheonan',
      category: 'dermatology',
      slug: 'doctor-evers',
    })
  })

  it('/cheonan/dermatology (2단계)', () => {
    expect(parseLocalPath('/cheonan/dermatology')).toEqual({
      city: 'cheonan',
      category: 'dermatology',
      slug: null,
    })
  })

  it('쿼리 제거', () => {
    expect(parseLocalPath('/cheonan/dermatology?tab=faq').category).toBe('dermatology')
  })

  it('해시 제거', () => {
    expect(parseLocalPath('/cheonan#top').city).toBe('cheonan')
  })

  it('루트 / → 모두 null', () => {
    expect(parseLocalPath('/')).toEqual({ city: null, category: null, slug: null })
  })
})
