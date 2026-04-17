import { execSync } from 'node:child_process'

export interface GitCommit {
  hash: string
  message: string
  body: string
}

function runGit(cmd: string): string {
  return execSync(`git ${cmd}`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] })
    .trim()
}

/** Commits on HEAD that are not on the base branch. */
export function getCommitsSinceBase(baseBranch: string): GitCommit[] {
  let range: string
  try {
    runGit(`rev-parse --verify origin/${baseBranch}`)
    range = `origin/${baseBranch}..HEAD`
  } catch {
    try {
      runGit(`rev-parse --verify ${baseBranch}`)
      range = `${baseBranch}..HEAD`
    } catch {
      return []
    }
  }

  const raw = runGit(`log ${range} --format=%H%x00%s%x00%b%x1f`)
  if (!raw) return []

  return raw
    .split('\x1f')
    .map(s => s.trim())
    .filter(Boolean)
    .map(entry => {
      const [hash, message, body] = entry.split('\x00')
      return { hash: hash ?? '', message: message ?? '', body: body ?? '' }
    })
}

/** Source files changed vs base branch (staged + committed). */
export function getChangedFiles(baseBranch: string): string[] {
  let mergeBase: string
  try {
    mergeBase = runGit(`merge-base HEAD origin/${baseBranch}`)
  } catch {
    try {
      mergeBase = runGit(`merge-base HEAD ${baseBranch}`)
    } catch {
      return []
    }
  }

  const diff = runGit(`diff --name-only --diff-filter=ACMR ${mergeBase} HEAD`)
  const staged = runGit(`diff --name-only --cached --diff-filter=ACMR`)
  const unstaged = runGit(`diff --name-only --diff-filter=ACMR`)

  const all = [diff, staged, unstaged]
    .flatMap(s => s.split('\n'))
    .map(s => s.trim())
    .filter(Boolean)

  return Array.from(new Set(all))
}

export function getCurrentCommitHash(): string {
  return runGit('rev-parse HEAD')
}

export function getCommitMessage(hash: string): string {
  return runGit(`log -1 --format=%B ${hash}`)
}
