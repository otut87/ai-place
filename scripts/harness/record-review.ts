#!/usr/bin/env tsx
/**
 * Record a code review entry in .harness/review-log.jsonl
 *
 * Usage:
 *   npm run harness:review -- --task T-001 --files src/lib/data.ts,src/lib/format/rating.ts
 *   npm run harness:review -- --task T-001 --files "src/lib/**"
 *   npm run harness:review -- --task T-001 --auto     # auto-detect from git
 */

import { appendFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { loadConfig } from './util/config'
import { getChangedFiles, getCurrentCommitHash } from './util/git'
import { log } from './util/logger'

interface Args {
  taskId: string
  files: string[]
  reviewer: string
  notes: string
  auto: boolean
}

function parseArgs(): Args {
  const argv = process.argv.slice(2)
  const args: Args = { taskId: '', files: [], reviewer: 'self', notes: '', auto: false }

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const next = argv[i + 1]
    if (a === '--task' && next) { args.taskId = next; i++ }
    else if (a === '--files' && next) { args.files = next.split(',').map(s => s.trim()).filter(Boolean); i++ }
    else if (a === '--reviewer' && next) { args.reviewer = next; i++ }
    else if (a === '--notes' && next) { args.notes = next; i++ }
    else if (a === '--auto') { args.auto = true }
    else if (a === '--help' || a === '-h') { printUsage(); process.exit(0) }
  }

  return args
}

function printUsage(): void {
  console.log(`
Usage:
  npm run harness:review -- --task T-NNN --files <comma-separated>
  npm run harness:review -- --task T-NNN --auto

Options:
  --task T-NNN         TASK ID being reviewed (required)
  --files path,path    Explicit file list (comma-separated)
  --auto               Use git-changed files since base branch
  --reviewer NAME      Defaults to "self"
  --notes "TEXT"       Optional review notes
  --help               Show this message
`)
}

function main(): void {
  const args = parseArgs()

  if (!args.taskId) {
    log.error('Missing --task T-NNN')
    printUsage()
    process.exit(1)
  }
  if (!/^T-\d{3}[a-z]?$/.test(args.taskId)) {
    log.error(`Invalid TASK ID: ${args.taskId} (expected T-NNN or T-NNNa)`)
    process.exit(1)
  }

  const cfg = loadConfig()

  let files = args.files
  if (args.auto) {
    files = getChangedFiles(cfg.baseBranch).filter(f => {
      const n = f.replace(/\\/g, '/')
      return n.startsWith('src/lib/') && (n.endsWith('.ts') || n.endsWith('.tsx'))
    })
  }
  if (files.length === 0) {
    log.error('No files to record. Use --files or --auto.')
    process.exit(1)
  }

  const entry = {
    commit: safeCommitHash(),
    timestamp: new Date().toISOString(),
    reviewer: args.reviewer,
    taskId: args.taskId,
    files,
    notes: args.notes || undefined,
  }

  const logPath = resolve(process.cwd(), cfg.reviewLog.path)
  appendFileSync(logPath, JSON.stringify(entry) + '\n', 'utf-8')

  log.pass(`Review recorded: ${args.taskId} (${files.length} file${files.length === 1 ? '' : 's'})`)
  log.info(`→ ${cfg.reviewLog.path}`)
}

function safeCommitHash(): string {
  try { return getCurrentCommitHash() } catch { return 'uncommitted' }
}

main()
