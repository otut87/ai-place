// 읽기 전용 Supabase 클라이언트 — cookies 미사용, SSG 호환
// 데이터 조회에만 사용. 인증 불필요.
//
// 싱글톤 캐시 + 환경변수는 함수 호출 시점에 읽기 (ESM top-level 평가 문제 회피).
// scripts/* 에서 @next/env loadEnvConfig 호출 후에도 동작 보장.

import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

let client: ReturnType<typeof createClient<Database>> | null = null

export function getReadClient() {
  if (client) return client
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) return null
  client = createClient<Database>(supabaseUrl, supabaseAnonKey)
  return client
}
