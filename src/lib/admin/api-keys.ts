// T-095 — API 키 관리 (읽기 전용).
// 설계안 §3.11 에서 언급한 "API 키 관리" 최소 버전.
// 원칙: 키 값은 .env.local 에서 관리. UI 는 존재 여부와 일부 마스킹만 노출.

export interface ApiKeyInfo {
  name: string
  envVar: string
  present: boolean
  masked: string | null
  usedBy: string
}

const API_KEY_DEFS: Array<Omit<ApiKeyInfo, 'present' | 'masked'>> = [
  { name: 'Supabase URL',         envVar: 'NEXT_PUBLIC_SUPABASE_URL',      usedBy: '클라이언트·서버 연결' },
  { name: 'Supabase anon',        envVar: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', usedBy: '브라우저 auth' },
  { name: 'Supabase service',     envVar: 'SUPABASE_SERVICE_ROLE_KEY',     usedBy: '서버 RLS 우회' },
  { name: 'OpenAI',               envVar: 'OPENAI_API_KEY',                usedBy: '인용 테스트' },
  { name: 'Anthropic (Claude)',   envVar: 'ANTHROPIC_API_KEY',             usedBy: '콘텐츠 생성' },
  { name: 'Gemini',               envVar: 'GEMINI_API_KEY',                usedBy: '인용 테스트' },
  { name: 'Google Places',        envVar: 'GOOGLE_PLACES_API_KEY',         usedBy: '수집' },
  { name: 'Naver Client ID',      envVar: 'NAVER_CLIENT_ID',               usedBy: '수집' },
  { name: 'Naver Client Secret',  envVar: 'NAVER_CLIENT_SECRET',           usedBy: '수집' },
  { name: 'Kakao REST',           envVar: 'KAKAO_REST_KEY',                usedBy: '수집' },
  { name: 'Toss 클라이언트',       envVar: 'NEXT_PUBLIC_TOSS_CLIENT_KEY',   usedBy: '결제 위젯' },
  { name: 'Toss 시크릿',          envVar: 'TOSS_SECRET_KEY',                usedBy: '결제 승인' },
  { name: 'Toss 웹훅',            envVar: 'TOSS_WEBHOOK_SECRET',            usedBy: '웹훅 검증' },
  { name: 'Resend',               envVar: 'RESEND_API_KEY',                 usedBy: '이메일' },
  { name: 'Resend From',          envVar: 'RESEND_FROM',                    usedBy: '발신 주소' },
  { name: 'Slack Webhook',        envVar: 'SLACK_WEBHOOK_URL',              usedBy: '알림' },
  { name: 'Admin Notify Email',   envVar: 'ADMIN_NOTIFY_EMAIL',             usedBy: '알림 수신' },
  { name: 'Vercel Cron',          envVar: 'VERCEL_CRON_SECRET',             usedBy: 'Cron 인증' },
]

export function maskKey(value: string | undefined | null): string | null {
  if (!value) return null
  const s = value.trim()
  if (s.length === 0) return null
  if (s.length <= 6) return '••••'
  const head = s.slice(0, 4)
  const tail = s.slice(-4)
  return `${head}••••${tail}`
}

export function getApiKeyInfo(): ApiKeyInfo[] {
  return API_KEY_DEFS.map(def => {
    const raw = process.env[def.envVar]
    return {
      ...def,
      present: !!raw && raw.length > 0,
      masked: maskKey(raw),
    }
  })
}

/** 노출·존재 여부로 그룹화 — UI 표시용. */
export function groupApiKeys(keys: ApiKeyInfo[]): { present: ApiKeyInfo[]; missing: ApiKeyInfo[] } {
  return {
    present: keys.filter(k => k.present),
    missing: keys.filter(k => !k.present),
  }
}
