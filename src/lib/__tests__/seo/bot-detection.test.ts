import { describe, it, expect } from 'vitest'
import { identifyBot, parseLocalPath, AI_BOT_PATTERNS, getBotPattern, BOT_GROUP_LABEL } from '@/lib/seo/bot-detection'

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

  it('Googlebot — 정규 검색', () => {
    expect(identifyBot('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)')?.id).toBe('googlebot')
  })

  it('GoogleOther — Googlebot보다 먼저 매칭', () => {
    // UA에 "Googlebot"과 "GoogleOther"가 함께 있더라도 GoogleOther가 이겨야 함
    const bot = identifyBot('Mozilla/5.0 (compatible; GoogleOther; Googlebot-like) +https://google.com')
    expect(bot?.id).toBe('googleother')
  })

  it('Google-Extended — Googlebot보다 먼저 매칭', () => {
    expect(identifyBot('Mozilla/5.0 Google-Extended Googlebot/2.1')?.id).toBe('google-extended')
  })

  it('Bingbot', () => {
    expect(identifyBot('Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)')?.id).toBe('bingbot')
  })

  it('DuckDuckBot', () => {
    expect(identifyBot('DuckDuckBot/1.1; (+http://duckduckgo.com/duckduckbot.html)')?.id).toBe('duckduckbot')
  })

  it('DuckAssistBot — AI 검색 그룹', () => {
    expect(identifyBot('DuckAssistBot/1.0')?.group).toBe('ai-search')
  })

  it('Naver Yeti', () => {
    expect(identifyBot('Mozilla/5.0 (compatible; Yeti/1.1; +https://naver.me/spd)')?.id).toBe('yeti')
  })

  it('Daumoa', () => {
    expect(identifyBot('Mozilla/5.0 (compatible; Daumoa/3.0)')?.id).toBe('daumoa')
  })

  it('Applebot-Extended — Applebot보다 우선', () => {
    // Applebot-Extended가 Applebot-Extended 그룹(AI 학습)에 매칭되어야 함
    expect(identifyBot('Mozilla/5.0 (compatible; Applebot-Extended/0.1)')?.id).toBe('applebot-extended')
  })

  it('Applebot (정규 검색) — Extended 아닐 때만', () => {
    expect(identifyBot('Mozilla/5.0 (compatible; Applebot/0.1)')?.id).toBe('applebot')
  })

  it('Meta-ExternalAgent', () => {
    expect(identifyBot('meta-externalagent/1.1')?.id).toBe('meta-externalagent')
  })

  it('Chrome-Lighthouse → null (크롤러 아님)', () => {
    expect(identifyBot('Mozilla/5.0 Chrome-Lighthouse')).toBeNull()
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

  it('AI_BOT_PATTERNS 20종 이상', () => {
    expect(AI_BOT_PATTERNS.length).toBeGreaterThanOrEqual(20)
  })

  it('모든 패턴은 group 필드를 가진다', () => {
    for (const p of AI_BOT_PATTERNS) {
      expect(['ai-training', 'ai-search', 'search', 'crawler-other']).toContain(p.group)
    }
  })
})

describe('getBotPattern', () => {
  it('id로 BotPattern 조회', () => {
    expect(getBotPattern('gptbot')?.label).toBe('GPTBot (OpenAI)')
  })

  it('없는 id → undefined', () => {
    expect(getBotPattern('nonexistent')).toBeUndefined()
  })
})

describe('BOT_GROUP_LABEL', () => {
  it('모든 그룹에 한국어 라벨이 있다', () => {
    expect(BOT_GROUP_LABEL['ai-training']).toBe('AI 학습')
    expect(BOT_GROUP_LABEL['ai-search']).toBe('AI 검색')
    expect(BOT_GROUP_LABEL['search']).toBe('정규 검색')
    expect(BOT_GROUP_LABEL['crawler-other']).toBe('기타 크롤러')
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
