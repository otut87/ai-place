// AI 베이스라인 측정 스크립트
// 각 AI 엔진에 프롬프트를 보내고, 응답에서 인용/언급을 추출하여 Supabase에 저장
//
// 실행: npm run baseline:test
// 옵션: --engine chatgpt|claude|gemini|all (기본: all)
//       --repeat 3 (프롬프트당 반복 횟수, 기본: 3)
//       --dry-run (DB 저장 없이 결과만 출력)

// @next/env 를 먼저 로드 — Next 와 동일한 .env 우선순위로 process.env 채움
import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())

import { createClient } from '@supabase/supabase-js'

// --- 환경변수 ---
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const OPENAI_KEY = process.env.OPENAI_API_KEY
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY
const GEMINI_KEY = process.env.GEMINI_API_KEY

if (!SUPABASE_URL || !SUPABASE_KEY || !OPENAI_KEY || !ANTHROPIC_KEY || !GEMINI_KEY) {
  console.error('Missing required environment variables. Need: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY, GEMINI_API_KEY')
  process.exit(1)
}

// Type narrowing — after the check above, these are all strings
const ENV = {
  supabaseUrl: SUPABASE_URL,
  supabaseKey: SUPABASE_KEY,
  openaiKey: OPENAI_KEY,
  anthropicKey: ANTHROPIC_KEY,
  geminiKey: GEMINI_KEY,
}

// --- Args ---
const args = process.argv.slice(2)
const engineArg = args.find(a => a.startsWith('--engine='))?.split('=')[1] ?? 'all'
const repeatArg = parseInt(args.find(a => a.startsWith('--repeat='))?.split('=')[1] ?? '3')
const dryRun = args.includes('--dry-run')

const supabase = createClient(ENV.supabaseUrl, ENV.supabaseKey)

type Engine = 'chatgpt' | 'claude' | 'gemini'

// --- AI 엔진별 호출 ---

async function callChatGPT(prompt: string): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ENV.openaiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-search-preview',
      messages: [{ role: 'user', content: prompt }],
      web_search_options: { search_context_size: 'medium' },
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`ChatGPT API error ${res.status}: ${err}`)
  }
  const data = await res.json()
  return data.choices?.[0]?.message?.content ?? ''
}

async function callClaude(prompt: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ENV.anthropicKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Claude API error ${res.status}: ${err}`)
  }
  const data = await res.json()
  const textBlock = data.content?.find((b: { type: string }) => b.type === 'text')
  return textBlock?.text ?? ''
}

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

async function callGemini(prompt: string, retries = 3): Promise<string> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${ENV.geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          tools: [{ google_search: {} }],
        }),
      },
    )
    if (res.ok) {
      const data = await res.json()
      const parts = data.candidates?.[0]?.content?.parts ?? []
      return parts.map((p: { text?: string }) => p.text ?? '').join('\n')
    }
    if ((res.status === 429 || res.status === 503) && attempt < retries) {
      const wait = Math.min(15000 * (attempt + 1), 60000)
      console.log(`    Rate limit (${res.status}), ${wait/1000}s 대기 후 재시도...`)
      await sleep(wait)
      continue
    }
    const err = await res.text()
    throw new Error(`Gemini API error ${res.status}: ${err}`)
  }
  throw new Error('Gemini: max retries exceeded')
}

async function callEngine(engine: Engine, prompt: string): Promise<string> {
  switch (engine) {
    case 'chatgpt': return callChatGPT(prompt)
    case 'claude': return callClaude(prompt)
    case 'gemini': return callGemini(prompt)
  }
}

// --- 인용 추출 ---

function extractUrls(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s\]\)>"']+/g
  return [...new Set(text.match(urlRegex) ?? [])]
}

function extractPlaceNames(text: string, knownNames: string[]): string[] {
  return knownNames.filter(name => text.includes(name))
}

// --- 메인 ---

async function main() {
  console.log(`AI 베이스라인 측정 시작`)
  console.log(`엔진: ${engineArg}, 반복: ${repeatArg}회, dry-run: ${dryRun}`)
  console.log('---')

  // 프롬프트 목록 가져오기
  const { data: prompts, error: promptsErr } = await supabase
    .from('test_prompts')
    .select('*')
    .order('created_at')

  if (promptsErr || !prompts?.length) {
    console.error('프롬프트를 가져올 수 없습니다:', promptsErr)
    console.error('먼저 npx tsx scripts/seed-places.ts 를 실행하세요.')
    process.exit(1)
  }

  // 알려진 업체명 목록
  const { data: places } = await supabase
    .from('places')
    .select('name')

  const knownNames = places?.map(p => p.name) ?? []

  const engines: Engine[] = engineArg === 'all'
    ? ['chatgpt', 'claude', 'gemini']
    : [engineArg as Engine]

  let totalTests = 0
  let totalCitations = 0
  const results: Array<{
    engine: Engine
    prompt: string
    citedSources: string[]
    citedPlaces: string[]
    aiplaceCited: boolean
  }> = []

  for (const engine of engines) {
    console.log(`\n=== ${engine.toUpperCase()} ===`)

    for (const prompt of prompts) {
      for (let i = 0; i < repeatArg; i++) {
        const sessionId = `baseline-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

        try {
          console.log(`  [${engine}] "${prompt.text}" (${i + 1}/${repeatArg})...`)
          const response = await callEngine(engine, prompt.text)

          const citedSources = extractUrls(response)
          const citedPlaces = extractPlaceNames(response, knownNames)
          const aiplaceCited = citedSources.some(url => url.includes('aiplace'))

          totalTests++
          if (aiplaceCited) totalCitations++

          results.push({
            engine,
            prompt: prompt.text,
            citedSources,
            citedPlaces,
            aiplaceCited,
          })

          // DB에 저장
          if (!dryRun) {
            const { error } = await supabase.from('citation_results').insert({
              prompt_id: prompt.id,
              engine,
              response,
              cited_sources: citedSources,
              cited_places: citedPlaces,
              aiplace_cited: aiplaceCited,
              session_id: sessionId,
            })
            if (error) console.error(`    DB 저장 실패:`, error.message)
          }

          // 요약 출력
          const sourcesStr = citedSources.length > 0
            ? citedSources.slice(0, 3).join(', ') + (citedSources.length > 3 ? '...' : '')
            : '(없음)'
          const placesStr = citedPlaces.length > 0 ? citedPlaces.join(', ') : '(없음)'
          console.log(`    소스: ${sourcesStr}`)
          console.log(`    업체: ${placesStr}`)

          // Rate limit 대비 대기 (Gemini 무료 티어: 분당 5회)
          const delay = engine === 'gemini' ? 15000 : 1000
          await sleep(delay)
        } catch (err) {
          console.error(`    오류: ${(err as Error).message}`)
        }
      }
    }
  }

  // --- 최종 리포트 ---
  console.log('\n' + '='.repeat(60))
  console.log('베이스라인 측정 결과 요약')
  console.log('='.repeat(60))
  console.log(`총 테스트: ${totalTests}`)
  console.log(`AI Place 인용: ${totalCitations}`)
  console.log('')

  // 엔진별 요약
  for (const engine of engines) {
    const engineResults = results.filter(r => r.engine === engine)
    console.log(`[${engine.toUpperCase()}]`)

    // 가장 많이 인용된 소스
    const allSources = engineResults.flatMap(r => r.citedSources)
    const sourceCounts = new Map<string, number>()
    allSources.forEach(s => {
      const domain = (() => { try { return new URL(s).hostname } catch { return s } })()
      sourceCounts.set(domain, (sourceCounts.get(domain) ?? 0) + 1)
    })
    const topSources = [...sourceCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
    console.log(`  Top 인용 소스:`)
    topSources.forEach(([domain, count]) => console.log(`    ${domain}: ${count}회`))

    // 가장 많이 언급된 업체
    const allPlaces = engineResults.flatMap(r => r.citedPlaces)
    const placeCounts = new Map<string, number>()
    allPlaces.forEach(p => placeCounts.set(p, (placeCounts.get(p) ?? 0) + 1))
    const topPlaces = [...placeCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
    console.log(`  Top 언급 업체:`)
    topPlaces.forEach(([name, count]) => console.log(`    ${name}: ${count}회`))
    console.log('')
  }
}

main().catch(console.error)
