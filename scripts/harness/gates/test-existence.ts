import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { matchesAnyGlob } from '../util/glob'

export interface TestExistenceConfig {
  testDir: string
  testSuffix: string
  excludePatterns: string[]
}

export interface TestExistenceViolation {
  file: string
  expectedTestPath: string
}

export interface TestExistenceResult {
  ok: boolean
  violations: TestExistenceViolation[]
}

const SOURCE_ROOT = 'src/lib/'

/** pathExists is injected for testability. */
export function validateTestExistence(
  changedFiles: string[],
  config: TestExistenceConfig,
  pathExists: (p: string) => boolean,
): TestExistenceResult {
  const violations: TestExistenceViolation[] = []

  for (const file of changedFiles) {
    const normalized = file.replace(/\\/g, '/')

    if (!normalized.startsWith(SOURCE_ROOT)) continue
    if (!normalized.endsWith('.ts') && !normalized.endsWith('.tsx')) continue
    if (matchesAnyGlob(normalized, config.excludePatterns)) continue

    const relativeInLib = normalized.slice(SOURCE_ROOT.length)
    const base = relativeInLib.replace(/\.(ts|tsx)$/, '')
    const expectedTestPath = `${config.testDir}/${base}${config.testSuffix}`

    if (!pathExists(expectedTestPath)) {
      violations.push({ file: normalized, expectedTestPath })
    }
  }

  return { ok: violations.length === 0, violations }
}

/** Real filesystem-backed existence checker. */
export function makeFsExists(projectRoot = process.cwd()): (p: string) => boolean {
  return (p: string) => existsSync(resolve(projectRoot, p))
}
