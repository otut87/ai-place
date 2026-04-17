#!/usr/bin/env tsx
/**
 * Git commit-msg hook — enforces TASK ref in commit messages.
 * Invoked by husky: `npm run harness:commit-msg -- "$1"`
 */

import { readFileSync } from 'node:fs'
import { loadConfig } from '../util/config'
import { log } from '../util/logger'

const msgFile = process.argv[2]
if (!msgFile) {
  log.error('commit-msg hook: missing message file argument')
  process.exit(1)
}

const msg = readFileSync(msgFile, 'utf-8').trim()

// Skip merge / revert / fixup commits
if (/^(Merge|Revert|fixup!|squash!)/i.test(msg)) process.exit(0)

const cfg = loadConfig()
const regex = new RegExp(cfg.taskRefPattern)

if (!regex.test(msg)) {
  log.error(`Commit message must contain a TASK reference matching ${cfg.taskRefPattern}`)
  log.info(`  Example: "feat: T-001 suppress ghost dermatology entries"`)
  log.info(`  Or:      "fix: update WO-#11 AggregateRating schema"`)
  log.info('')
  log.info('Bypass (NOT recommended): git commit --no-verify')
  process.exit(1)
}

process.exit(0)
