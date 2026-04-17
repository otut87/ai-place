import type { GitCommit } from '../util/git'

export interface TaskRefViolation {
  commit: string
  message: string
}

export interface TaskRefResult {
  ok: boolean
  violations: TaskRefViolation[]
}

export function validateTaskRef(commits: GitCommit[], pattern: string): TaskRefResult {
  const regex = new RegExp(pattern)
  const violations: TaskRefViolation[] = []

  for (const c of commits) {
    const combined = `${c.message}\n${c.body}`
    if (!regex.test(combined)) {
      violations.push({ commit: c.hash, message: c.message })
    }
  }

  return { ok: violations.length === 0, violations }
}
