// T-259 — Vercel production deploy 시 필수 env 누락 즉시 실패.
//
// rate-limit.ts 가 production 에서 hard-fail 로 변경됨. UPSTASH/KV env 누락 시
// 모든 /check, signup, 신고 RL 호출이 503. 사용자가 발견하기 전에 빌드 단계에서 차단.
//
// VERCEL_ENV=production (Vercel 자동 주입) 일 때만 검사.
// 로컬 / Preview / dev 빌드는 통과 (env 일부 빠져도 OK).

const isVercelProd = process.env.VERCEL === '1' && process.env.VERCEL_ENV === 'production'

if (!isVercelProd) {
  console.log('[check-prod-env] not Vercel production build — skipping')
  process.exit(0)
}

// rate-limit.ts 가 둘 중 하나의 페어로 동작 (UPSTASH 직접 또는 Vercel Marketplace KV).
const hasUpstashPair = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
const hasKvPair = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)

const required: Array<{ key: string; reason: string }> = [
  { key: 'NEXT_PUBLIC_SUPABASE_URL', reason: 'Supabase 인증/DB' },
  { key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', reason: 'Supabase 클라이언트' },
  { key: 'SUPABASE_SERVICE_ROLE_KEY', reason: 'admin DB 작업' },
  { key: 'ANTHROPIC_API_KEY', reason: 'AI 콘텐츠 생성' },
  { key: 'GOOGLE_PLACES_API_KEY', reason: '업체 등록 보강' },
  { key: 'RESEND_API_KEY', reason: '이메일 발송' },
  { key: 'VERCEL_CRON_SECRET', reason: 'cron 인증' },
]

const missing = required.filter(({ key }) => !process.env[key]).map(r => `${r.key} (${r.reason})`)

if (!hasUpstashPair && !hasKvPair) {
  missing.push('UPSTASH_REDIS_REST_URL+TOKEN 또는 KV_REST_API_URL+TOKEN (rate-limit; 미설정 시 production 503)')
}

if (missing.length > 0) {
  console.error('[check-prod-env] FAIL — production 필수 env 누락:')
  for (const m of missing) console.error(`  - ${m}`)
  console.error('\nVercel Project Settings → Environment Variables 에서 production 환경에 설정 후 재배포.')
  process.exit(1)
}

console.log('[check-prod-env] OK — 모든 필수 env 검증 통과')
