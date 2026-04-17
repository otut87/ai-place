import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { matchesGlob } from '../util/glob'

export interface ReviewEntry {
  commit: string
  files: string[]
  timestamp: string
  reviewer: string
  taskId: string
  notes?: string
}

export interface ReviewViolation {
  file: string
  reason: 'unreviewed'
}

export interface ReviewResult {
  ok: boolean
  violations: ReviewViolation[]
}

export function parseReviewLog(raw: string): ReviewEntry[] {
  return raw
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => JSON.parse(line) as ReviewEntry)
}

export function loadReviewLog(logPath: string, projectRoot = process.cwd()): ReviewEntry[] {
  const full = resolve(projectRoot, logPath)
  if (!existsSync(full)) return []
  const raw = readFileSync(full, 'utf-8')
  return parseReviewLog(raw)
}

export function validateReview(
  changedFiles: string[],
  log: ReviewEntry[],
  requiredPattern: string,
): ReviewResult {
  const reviewedFiles = new Set(log.flatMap(e => e.files.map(f => f.replace(/\\/g, '/'))))
  const violations: ReviewViolation[] = []

  for (const file of changedFiles) {
    const normalized = file.replace(/\\/g, '/')
    if (!matchesGlob(normalized, requiredPattern)) continue
    if (!reviewedFiles.has(normalized)) {
      violations.push({ file: normalized, reason: 'unreviewed' })
    }
  }

  return { ok: violations.length === 0, violations }
}
