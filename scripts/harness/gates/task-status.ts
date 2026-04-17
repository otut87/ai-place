import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'unknown'

export interface TaskStatusViolation {
  taskId: string
  reason: 'not_in_doc' | 'not_started' | 'status_marker_missing'
}

export interface TaskStatusResult {
  ok: boolean
  violations: TaskStatusViolation[]
}

const TASK_REF_REGEX = /\bT-\d{3}[a-z]?\b/g
const TASK_HEADING_REGEX = /^##\s+(T-\d{3}[a-z]?)\b(.*)$/gm

export function extractTaskRefs(text: string): string[] {
  const matches = text.match(TASK_REF_REGEX) ?? []
  return Array.from(new Set(matches))
}

export function parseTaskStatusFromDoc(doc: string): Record<string, TaskStatus> {
  const out: Record<string, TaskStatus> = {}
  for (const m of doc.matchAll(TASK_HEADING_REGEX)) {
    const id = m[1]
    const rest = m[2] ?? ''
    out[id] = detectStatus(rest)
  }
  return out
}

function detectStatus(headingTail: string): TaskStatus {
  if (headingTail.includes('✅') || headingTail.includes('완료')) return 'completed'
  if (headingTail.includes('⏳') || headingTail.includes('진행')) return 'in_progress'
  if (headingTail.includes('🔜') || headingTail.includes('대기')) return 'pending'
  return 'unknown'
}

export function loadTaskStatuses(taskDocPath: string, projectRoot = process.cwd()): Record<string, TaskStatus> {
  const full = resolve(projectRoot, taskDocPath)
  if (!existsSync(full)) return {}
  const raw = readFileSync(full, 'utf-8')
  return parseTaskStatusFromDoc(raw)
}

export function validateTaskStatus(
  refs: string[],
  statuses: Record<string, TaskStatus>,
): TaskStatusResult {
  const violations: TaskStatusViolation[] = []

  for (const id of refs) {
    if (!(id in statuses)) {
      violations.push({ taskId: id, reason: 'not_in_doc' })
      continue
    }
    const status = statuses[id]
    if (status === 'pending') {
      violations.push({ taskId: id, reason: 'not_started' })
    } else if (status === 'unknown') {
      violations.push({ taskId: id, reason: 'status_marker_missing' })
    }
  }

  return { ok: violations.length === 0, violations }
}
