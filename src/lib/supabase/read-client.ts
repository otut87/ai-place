// 읽기 전용 Supabase 클라이언트 — cookies 미사용, SSG 호환
// 데이터 조회에만 사용. 인증 불필요.
//
// 모듈 레벨 싱글톤: anon key + 읽기 전용이므로 요청 간 공유 안전.
// 키 로테이션 시 프로세스 재시작 필요 (Vercel 배포 시 자동).

import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

let client: ReturnType<typeof createClient<Database>> | null = null

export function getReadClient() {
  if (!supabaseUrl || !supabaseAnonKey) return null
  if (!client) {
    client = createClient<Database>(supabaseUrl, supabaseAnonKey, {
      global: {
        // Next.js SSG fetch 캐시 무효화: DB 쿼리는 매번 최신 데이터를 조회해야 하므로 요청별 고유 헤더 설정
        fetch: (url, options) => {
          const headers = new Headers(options?.headers)
          headers.set('X-Cache-Bust', Date.now().toString())
          return fetch(url, { ...options, headers })
        },
      },
    })
  }
  return client
}
