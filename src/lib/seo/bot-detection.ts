// T-081 — User-Agent → AI 봇 식별.
// 목록: GPTBot, ClaudeBot, PerplexityBot, CCBot, Google-Extended,
//       anthropic-ai, cohere-ai, YouBot, AI2Bot, Bytespider, Amazonbot.
//
// 원칙: string includes (lowercased). 식별 실패 시 null 반환 → bot_visits insert 스킵.

export interface BotPattern {
  id: string                    // snake_case key — DB bot_id
  label: string                 // UI 표기용
  pattern: RegExp
}

export const AI_BOT_PATTERNS: BotPattern[] = [
  { id: 'gptbot',           label: 'GPTBot (OpenAI)',         pattern: /GPTBot/i },
  { id: 'chatgpt-user',     label: 'ChatGPT-User',            pattern: /ChatGPT-User/i },
  { id: 'oai-searchbot',    label: 'OAI-SearchBot',           pattern: /OAI-SearchBot/i },
  { id: 'claudebot',        label: 'ClaudeBot',               pattern: /ClaudeBot/i },
  { id: 'anthropic-ai',     label: 'anthropic-ai',            pattern: /anthropic-ai/i },
  { id: 'claude-web',       label: 'Claude-Web',              pattern: /Claude-Web/i },
  { id: 'perplexitybot',    label: 'PerplexityBot',           pattern: /PerplexityBot/i },
  { id: 'perplexity-user',  label: 'Perplexity-User',         pattern: /Perplexity-User/i },
  { id: 'ccbot',            label: 'CCBot (CommonCrawl)',     pattern: /CCBot/i },
  { id: 'google-extended',  label: 'Google-Extended',         pattern: /Google-Extended/i },
  { id: 'googleother',      label: 'GoogleOther',             pattern: /GoogleOther/i },
  { id: 'bytespider',       label: 'Bytespider (TikTok)',     pattern: /Bytespider/i },
  { id: 'amazonbot',        label: 'Amazonbot (Alexa/Rufus)', pattern: /Amazonbot/i },
  { id: 'applebot',         label: 'Applebot-Extended',       pattern: /Applebot-Extended/i },
  { id: 'youbot',           label: 'YouBot',                  pattern: /YouBot/i },
  { id: 'cohere-ai',        label: 'cohere-ai',               pattern: /cohere-ai/i },
  { id: 'ai2bot',           label: 'AI2Bot',                  pattern: /AI2Bot/i },
  { id: 'meta-externalagent', label: 'Meta-ExternalAgent',    pattern: /Meta-ExternalAgent/i },
  { id: 'diffbot',          label: 'Diffbot',                 pattern: /Diffbot/i },
]

export function identifyBot(ua: string | null | undefined): BotPattern | null {
  if (!ua) return null
  for (const p of AI_BOT_PATTERNS) {
    if (p.pattern.test(ua)) return p
  }
  return null
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
