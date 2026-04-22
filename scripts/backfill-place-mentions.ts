#!/usr/bin/env tsx
/**
 * scripts/backfill-place-mentions.ts — Sprint D-1 / T-200.
 *
 * 1회성 초기 백필: places / blog_posts / 레거시 content 를 모두 긁어 place_mentions 를 채운다.
 * sync-place-mentions.ts 와 동일 로직을 공유하되 기본값이 --content-scan --verbose.
 *
 * Usage:
 *   npx tsx scripts/backfill-place-mentions.ts [--dry-run]
 */

import path from 'path'
import { spawnSync } from 'node:child_process'

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')

const syncScript = path.resolve(__dirname, 'sync-place-mentions.ts')
const forwarded = ['--content-scan', '--verbose', ...(dryRun ? ['--dry-run'] : [])]

console.log(`[backfill-place-mentions] → sync-place-mentions ${forwarded.join(' ')}`)

const result = spawnSync(
  process.execPath.endsWith('tsx') ? process.execPath : 'npx',
  process.execPath.endsWith('tsx')
    ? [syncScript, ...forwarded]
    : ['tsx', syncScript, ...forwarded],
  { stdio: 'inherit', shell: process.platform === 'win32' },
)

process.exitCode = result.status ?? 0
