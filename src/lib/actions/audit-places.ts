'use server'

// T-055 — 업체 감사 로그 append + 조회.
// 어드민 인라인 편집·일괄 액션에서 변경 직전 upstream 에서 호출.

import { getAdminClient } from '@/lib/supabase/admin-client'
import {
  diffUpdate,
  normalizeActorType,
  type AuditAction,
  type AuditInsert,
  type ActorType,
  type FieldDiff,
} from '@/lib/admin/audit'

export interface AuditLogEntry {
  id: string
  place_id: string | null
  actor_id: string | null
  actor_type: ActorType
  action: AuditAction
  field: string | null
  before_value: unknown
  after_value: unknown
  reason: string | null
  created_at: string
}

export async function recordAudit(entry: AuditInsert): Promise<{ success: boolean; error?: string }> {
  const supabase = getAdminClient()
  if (!supabase) return { success: false, error: 'Admin 클라이언트 초기화 실패' }

  const row = {
    place_id: entry.placeId,
    actor_id: entry.actorId,
    actor_type: normalizeActorType(entry.actorType),
    action: entry.action,
    field: entry.field ?? null,
    before_value: entry.before ?? null,
    after_value: entry.after ?? null,
    reason: entry.reason ?? null,
  }

  // supabase-js 의 insert 타입을 우회하기 위해 as never 사용 (기존 코드 패턴과 동일)
  const { error } = await (supabase.from('place_audit_log') as ReturnType<typeof supabase.from>).insert(row as never)
  if (error) {
    console.error('[audit] recordAudit insert 실패:', error)
    return { success: false, error: '감사 로그 기록 실패' }
  }
  return { success: true }
}

/** 업데이트 diff 를 여러 엔트리로 append. 변경 없음이면 조용히 종료. */
export async function recordUpdateDiffs(
  placeId: string,
  actorId: string | null,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  reason?: string,
  actorType?: ActorType,
): Promise<{ success: boolean; recorded: number; error?: string }> {
  const diffs: FieldDiff[] = diffUpdate(before, after)
  if (diffs.length === 0) return { success: true, recorded: 0 }

  const supabase = getAdminClient()
  if (!supabase) return { success: false, recorded: 0, error: 'Admin 클라이언트 초기화 실패' }

  const normalizedActor = normalizeActorType(actorType)
  const rows = diffs.map(d => ({
    place_id: placeId,
    actor_id: actorId,
    actor_type: normalizedActor,
    action: d.field === 'status' ? 'status' : 'update',
    field: d.field,
    before_value: d.before,
    after_value: d.after,
    reason: reason ?? null,
  }))

  const { error } = await (supabase.from('place_audit_log') as ReturnType<typeof supabase.from>).insert(rows as never)
  if (error) {
    console.error('[audit] recordUpdateDiffs insert 실패:', error)
    return { success: false, recorded: 0, error: '감사 로그 기록 실패' }
  }
  return { success: true, recorded: diffs.length }
}

/** place_id 기준 최근 N개 조회. */
export async function listAuditForPlace(placeId: string, limit = 50): Promise<AuditLogEntry[]> {
  const supabase = getAdminClient()
  if (!supabase) return []
  const { data, error } = await supabase
    .from('place_audit_log')
    .select('id, place_id, actor_id, actor_type, action, field, before_value, after_value, reason, created_at')
    .eq('place_id', placeId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error || !data) return []
  return data as unknown as AuditLogEntry[]
}
