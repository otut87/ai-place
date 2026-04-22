// T-081 — User-Agent → AI/검색 봇 식별.
//
// 분류(group):
//   ai-training    — 생성형 AI 학습 데이터 수집 크롤러
//   ai-search      — AI 사용자 질의 시점의 실시간 fetch / AI 검색 인덱스
//   search         — 정규 검색엔진 크롤러 (Google/Bing/Naver/Daum 등)
//   crawler-other  — 기타 식별 가능한 봇
//
// 식별 실패 시 null 반환 → bot_visits insert 스킵.
// 순서 중요: 더 구체적인 패턴(GoogleOther, Google-Extended)을 Googlebot보다 위에 둬야 함.

export type BotGroup = 'ai-training' | 'ai-search' | 'search' | 'crawler-other'

export interface BotPattern {
  id: string                    // snake_case key — DB bot_id
  label: string                 // UI 표기용
  group: BotGroup
  pattern: RegExp
}

export const AI_BOT_PATTERNS: BotPattern[] = [
  // === AI 학습용 크롤러 ===
  { id: 'gptbot',             label: 'GPTBot (OpenAI)',         group: 'ai-training',   pattern: /GPTBot/i },
  { id: 'claudebot',          label: 'ClaudeBot',               group: 'ai-training',   pattern: /ClaudeBot/i },
  { id: 'anthropic-ai',       label: 'anthropic-ai',            group: 'ai-training',   pattern: /anthropic-ai/i },
  { id: 'ccbot',              label: 'CCBot (CommonCrawl)',     group: 'ai-training',   pattern: /CCBot/i },
  { id: 'google-extended',    label: 'Google-Extended',         group: 'ai-training',   pattern: /Google-Extended/i },
  { id: 'bytespider',         label: 'Bytespider (TikTok)',     group: 'ai-training',   pattern: /Bytespider/i },
  { id: 'amazonbot',          label: 'Amazonbot (Alexa/Rufus)', group: 'ai-training',   pattern: /Amazonbot/i },
  { id: 'applebot-extended',  label: 'Applebot-Extended',       group: 'ai-training',   pattern: /Applebot-Extended/i },
  { id: 'cohere-ai',          label: 'cohere-ai',               group: 'ai-training',   pattern: /cohere-ai/i },
  { id: 'ai2bot',             label: 'AI2Bot',                  group: 'ai-training',   pattern: /AI2Bot/i },
  { id: 'meta-externalagent', label: 'Meta-ExternalAgent',      group: 'ai-training',   pattern: /Meta-ExternalAgent/i },

  // === AI 검색 / 실시간 질의 ===
  { id: 'chatgpt-user',       label: 'ChatGPT-User',            group: 'ai-search',     pattern: /ChatGPT-User/i },
  { id: 'oai-searchbot',      label: 'OAI-SearchBot',           group: 'ai-search',     pattern: /OAI-SearchBot/i },
  { id: 'claude-web',         label: 'Claude-Web',              group: 'ai-search',     pattern: /Claude-Web/i },
  { id: 'perplexitybot',      label: 'PerplexityBot',           group: 'ai-search',     pattern: /PerplexityBot/i },
  { id: 'perplexity-user',    label: 'Perplexity-User',         group: 'ai-search',     pattern: /Perplexity-User/i },
  { id: 'youbot',             label: 'YouBot',                  group: 'ai-search',     pattern: /YouBot/i },
  { id: 'duckassistbot',      label: 'DuckAssistBot (DDG AI)',  group: 'ai-search',     pattern: /DuckAssistBot/i },

  // === 기타 식별 가능한 Google 크롤러 (Googlebot 앞에 와야 함) ===
  { id: 'googleother',        label: 'GoogleOther',             group: 'crawler-other', pattern: /GoogleOther/i },
  { id: 'diffbot',            label: 'Diffbot',                 group: 'crawler-other', pattern: /Diffbot/i },

  // === 정규 검색 엔진 ===
  // Googlebot은 GoogleOther/Google-Extended 매칭 후 남은 것만 잡도록 뒤쪽.
  { id: 'googlebot',          label: 'Googlebot',               group: 'search',        pattern: /Googlebot/i },
  { id: 'bingbot',            label: 'Bingbot',                 group: 'search',        pattern: /bingbot/i },
  { id: 'duckduckbot',        label: 'DuckDuckBot',             group: 'search',        pattern: /DuckDuckBot/i },
  { id: 'yeti',               label: 'Yeti (Naver)',            group: 'search',        pattern: /Yeti/i },
  { id: 'daumoa',             label: 'Daumoa (Kakao)',          group: 'search',        pattern: /Daumoa/i },
  { id: 'applebot',           label: 'Applebot',                group: 'search',        pattern: /Applebot(?!-Extended)/i },
]

export function identifyBot(ua: string | null | undefined): BotPattern | null {
  if (!ua) return null
  for (const p of AI_BOT_PATTERNS) {
    if (p.pattern.test(ua)) return p
  }
  return null
}

export function getBotPattern(id: string): BotPattern | undefined {
  return AI_BOT_PATTERNS.find((p) => p.id === id)
}

export const BOT_GROUP_LABEL: Record<BotGroup, string> = {
  'ai-training':   'AI 학습',
  'ai-search':     'AI 검색',
  'search':        '정규 검색',
  'crawler-other': '기타 크롤러',
}

/** 경로에서 city/category/slug 추출 — `/cheonan/dermatology/doctor-evers` 형태. */
export function parseLocalPath(path: string): { city: string | null; category: string | null; slug: string | null } {
  // 쿼리·해시 제거
  const cleaned = path.split('?')[0].split('#')[0]
  const parts = cleaned.split('/').filter(Boolean)
  if (parts.length === 0) return { city: null, category: null, slug: null }
  return {
    city: parts[0] ?? null,
    category: parts[1] ?? null,
    slug: parts[2] ?? null,
  }
}
