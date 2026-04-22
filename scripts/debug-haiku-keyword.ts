// 디버그: Haiku tool_use 응답 구조 확인.
import path from 'path'
import dotenv from 'dotenv'
dotenv.config({ path: path.resolve('.env.local') })

async function main() {
  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const client = new Anthropic()

  const TOOL_SCHEMA = {
    type: 'object' as const,
    properties: {
      keywords: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            keyword: { type: 'string' },
            longtails: { type: 'array', items: { type: 'string' } },
            priority: { type: 'integer' },
            competition: { type: 'string' },
          },
          required: ['keyword', 'longtails', 'priority', 'competition'],
        },
      },
    },
    required: ['keywords'],
  }

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: '당신은 한국어 로컬 SEO 키워드 전문가. generate_keywords 도구를 호출하세요.',
    tools: [{
      name: 'generate_keywords',
      description: '5개 키워드 생성.',
      input_schema: TOOL_SCHEMA,
    }],
    tool_choice: { type: 'tool', name: 'generate_keywords' },
    messages: [{
      role: 'user',
      content: '천안 피부과 관련 타깃 키워드 5개를 generate_keywords 로 반환하세요. review-deepdive 앵글.',
    }],
  })

  console.log('=== stop_reason:', response.stop_reason)
  console.log('=== content[] length:', response.content.length)
  for (const b of response.content) {
    console.log('--- block type:', b.type)
    console.log(JSON.stringify(b, null, 2))
  }
  console.log('=== usage:', response.usage)
}

main().catch(e => { console.error(e); process.exit(1) })
