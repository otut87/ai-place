import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export interface HarnessConfig {
  version: string
  baseBranch: string
  taskRefPattern: string
  taskDocPath: string
  coverage: {
    threshold: number
    includePattern: string
    excludePatterns: string[]
  }
  testExistence: {
    sourcePattern: string
    testDir: string
    testSuffix: string
    excludePatterns: string[]
  }
  reviewLog: {
    path: string
    requireForFiles: string
  }
  buildExcludeFromAll: string[]
}

const CONFIG_PATH = '.harness/config.json'

let cached: HarnessConfig | null = null

export function loadConfig(projectRoot = process.cwd()): HarnessConfig {
  if (cached) return cached
  const path = resolve(projectRoot, CONFIG_PATH)
  const raw = readFileSync(path, 'utf-8')
  cached = JSON.parse(raw) as HarnessConfig
  return cached
}

export function resetConfigCache(): void {
  cached = null
}
