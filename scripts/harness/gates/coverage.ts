import { execSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { matchesAnyGlob, matchesGlob } from '../util/glob'

export interface CoverageConfig {
  threshold: number
  includePattern: string
  excludePatterns: string[]
}

interface CoverageEntry {
  lines: { pct: number }
}

export type CoverageSummary = Record<string, CoverageEntry>

export interface CoverageViolation {
  file: string
  coverage: number | null
  reason: 'below_threshold' | 'missing'
}

export interface CoverageResult {
  ok: boolean
  violations: CoverageViolation[]
  filesChecked: number
}

export function validateCoverage(
  changedFiles: string[],
  summary: CoverageSummary,
  config: CoverageConfig,
): CoverageResult {
  const violations: CoverageViolation[] = []
  let filesChecked = 0

  for (const file of changedFiles) {
    const normalized = file.replace(/\\/g, '/')
    if (!matchesGlob(normalized, config.includePattern)) continue
    if (matchesAnyGlob(normalized, config.excludePatterns)) continue
    filesChecked++

    const entry = findCoverageEntry(summary, normalized)
    if (!entry) {
      violations.push({ file: normalized, coverage: null, reason: 'missing' })
      continue
    }
    if (entry.lines.pct < config.threshold) {
      violations.push({ file: normalized, coverage: entry.lines.pct, reason: 'below_threshold' })
    }
  }

  return { ok: violations.length === 0, violations, filesChecked }
}

function findCoverageEntry(summary: CoverageSummary, path: string): CoverageEntry | null {
  if (summary[path]) return summary[path]
  const normalizedPath = path.replace(/\\/g, '/')
  for (const key of Object.keys(summary)) {
    const normalizedKey = key.replace(/\\/g, '/')
    if (normalizedKey.endsWith(normalizedPath)) return summary[key]
  }
  return null
}

/** Runs vitest --coverage and parses json-summary. */
export function runCoverageCapture(projectRoot = process.cwd()): CoverageSummary {
  try {
    execSync('npx vitest run --coverage --coverage.reporter=json-summary', {
      cwd: projectRoot,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
  } catch {
    // Even when tests fail, the summary may exist — proceed to parse.
    console.warn('[harness] vitest exited non-zero — attempting to read summary anyway')
  }

  const summaryPath = resolve(projectRoot, 'coverage', 'coverage-summary.json')
  if (!existsSync(summaryPath)) {
    throw new Error(`coverage-summary.json not found at ${summaryPath}`)
  }

  const raw = readFileSync(summaryPath, 'utf-8')
  const parsed = JSON.parse(raw) as Record<string, unknown>
  delete parsed.total

  return parsed as CoverageSummary
}
