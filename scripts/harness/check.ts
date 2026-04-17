#!/usr/bin/env tsx
/**
 * Harness check — runs all gates and exits 1 on any failure.
 *
 * Skip with: SKIP_HARNESS=1 npm run build
 * Skip specific gates: HARNESS_SKIP=coverage,review npm run harness:check
 */

import { loadConfig } from './util/config'
import { getChangedFiles, getCommitsSinceBase } from './util/git'
import { log } from './util/logger'
import { validateTaskRef } from './gates/task-ref'
import { validateTestExistence, makeFsExists } from './gates/test-existence'
import { validateCoverage, runCoverageCapture } from './gates/coverage'
import { validateReview, loadReviewLog } from './gates/review'
import { validateTaskStatus, extractTaskRefs, loadTaskStatuses } from './gates/task-status'

interface GateOutcome {
  name: string
  ok: boolean
  skipped?: boolean
  detail?: string
}

async function main(): Promise<void> {
  if (process.env.SKIP_HARNESS === '1') {
    log.warn('SKIP_HARNESS=1 — bypassing harness checks')
    return
  }

  const skipSet = new Set((process.env.HARNESS_SKIP ?? '').split(',').filter(Boolean))

  log.title('AI Place Development Harness')

  const cfg = loadConfig()
  const commits = getCommitsSinceBase(cfg.baseBranch)
  const changedFiles = getChangedFiles(cfg.baseBranch)

  log.info(`Base branch: ${cfg.baseBranch}`)
  log.info(`Commits since base: ${commits.length}`)
  log.info(`Changed files: ${changedFiles.length}`)

  const outcomes: GateOutcome[] = []

  // G1: TASK ref
  outcomes.push(await runGate('G1 TASK Ref', skipSet, () => {
    const res = validateTaskRef(commits, cfg.taskRefPattern)
    if (!res.ok) {
      for (const v of res.violations) {
        log.fail(`commit ${v.commit.slice(0, 7)} missing TASK ref: "${v.message}"`)
      }
      return { ok: false, detail: `${res.violations.length} commits without TASK ref` }
    }
    log.pass(`All ${commits.length} commits reference a TASK`)
    return { ok: true }
  }))

  // G2: Test existence
  outcomes.push(await runGate('G2 Test Existence', skipSet, () => {
    const res = validateTestExistence(changedFiles, cfg.testExistence, makeFsExists())
    if (!res.ok) {
      for (const v of res.violations) {
        log.fail(`${v.file} → expected test at ${v.expectedTestPath}`)
      }
      return { ok: false, detail: `${res.violations.length} files without tests` }
    }
    log.pass('All changed src/lib files have corresponding test files')
    return { ok: true }
  }))

  // G3: Coverage
  outcomes.push(await runGate('G3 Coverage', skipSet, () => {
    const shouldCheck = changedFiles.some(f => f.replace(/\\/g, '/').startsWith('src/lib/'))
    if (!shouldCheck) {
      log.info('No src/lib/** changes — skipping coverage run')
      return { ok: true }
    }
    log.info('Running vitest --coverage (this may take a moment)...')
    const summary = runCoverageCapture()
    const res = validateCoverage(changedFiles, summary, cfg.coverage)
    if (!res.ok) {
      for (const v of res.violations) {
        const cov = v.coverage === null ? 'missing' : `${v.coverage.toFixed(1)}%`
        log.fail(`${v.file} coverage: ${cov} (threshold ${cfg.coverage.threshold}%)`)
      }
      return { ok: false, detail: `${res.violations.length} files below ${cfg.coverage.threshold}% coverage` }
    }
    log.pass(`All ${res.filesChecked} changed src/lib files meet ${cfg.coverage.threshold}% coverage`)
    return { ok: true }
  }))

  // G4: Review
  outcomes.push(await runGate('G4 Review Log', skipSet, () => {
    const entries = loadReviewLog(cfg.reviewLog.path)
    const res = validateReview(changedFiles, entries, cfg.reviewLog.requireForFiles)
    if (!res.ok) {
      for (const v of res.violations) {
        log.fail(`${v.file} — no review record. Run: npm run harness:review -- --files ${v.file} --task T-XXX`)
      }
      return { ok: false, detail: `${res.violations.length} files without review record` }
    }
    log.pass(`All review-required files have log entries`)
    return { ok: true }
  }))

  // G5: TASK status
  // refs는 subject + body 의 명시적 "Refs " 라인만 카운트
  // (body 본문 forward-reference 가 false positive 를 만들지 않도록)
  outcomes.push(await runGate('G5 TASK Status', skipSet, () => {
    const allRefs = new Set<string>()
    for (const c of commits) {
      for (const r of extractTaskRefs(c.message)) allRefs.add(r)
      // body 에서는 "Refs T-NNN" 또는 "Refs: T-NNN" 같이 명시한 라인만 인정
      const refLines = c.body.split('\n').filter(l => /^\s*refs?\s*[:]?\s/i.test(l))
      for (const line of refLines) {
        for (const r of extractTaskRefs(line)) allRefs.add(r)
      }
    }
    const statuses = loadTaskStatuses(cfg.taskDocPath)
    const res = validateTaskStatus(Array.from(allRefs), statuses)
    if (!res.ok) {
      for (const v of res.violations) {
        const hint = v.reason === 'not_in_doc' ? 'add this TASK to TASKS.md'
                   : v.reason === 'not_started' ? 'update status to ⏳ or ✅'
                   : 'add 🔜/⏳/✅ marker to the heading'
        log.fail(`${v.taskId} — ${v.reason} (${hint})`)
      }
      return { ok: false, detail: `${res.violations.length} TASK status issues` }
    }
    log.pass(`All ${allRefs.size} referenced TASKs have progressed from 🔜`)
    return { ok: true }
  }))

  log.section('Summary')
  const failed = outcomes.filter(o => !o.ok && !o.skipped)
  for (const o of outcomes) {
    if (o.skipped) log.warn(`${o.name}: skipped`)
    else if (o.ok) log.pass(`${o.name}: ok`)
    else log.fail(`${o.name}: ${o.detail ?? 'failed'}`)
  }

  if (failed.length > 0) {
    log.error(`\nHarness failed: ${failed.length} gate(s) did not pass.`)
    log.info('Bypass (emergency only): SKIP_HARNESS=1 npm run build')
    process.exit(1)
  }
  log.section('✅ Harness passed.')
}

async function runGate(
  name: string,
  skipSet: Set<string>,
  fn: () => Promise<{ ok: boolean; detail?: string }> | { ok: boolean; detail?: string },
): Promise<GateOutcome> {
  const shortName = name.split(' ')[0].toLowerCase()
  log.title(name)
  if (skipSet.has(shortName.replace(/^g\d+$/, '')) || skipSet.has(shortName)) {
    log.warn('Gate skipped by HARNESS_SKIP')
    return { name, ok: true, skipped: true }
  }
  try {
    const res = await fn()
    return { name, ok: res.ok, detail: res.detail }
  } catch (err) {
    log.error(err instanceof Error ? err.message : String(err))
    return { name, ok: false, detail: err instanceof Error ? err.message : 'exception' }
  }
}

main().catch(err => {
  log.error(err instanceof Error ? err.stack ?? err.message : String(err))
  process.exit(1)
})
