// Admin용 Supabase 클라이언트 — service_role 키 사용
// RLS/트리거를 우회하여 status 변경, 삭제 등 admin 작업에 사용.
// 서버 사이드에서만 사용할 것.

import { createClient } from '@supabase/supabase-js'

// Database 타입 제네릭 없이 생성 — admin 작업은 타입보다 유연성 우선
export function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return null
  return createClient(url, serviceKey)
}
