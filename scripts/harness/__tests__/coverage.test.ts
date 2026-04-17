import { describe, it, expect } from 'vitest'
import { validateCoverage } from '../gates/coverage'

describe('validateCoverage', () => {
  const cfg = {
    threshold: 80,
    includePattern: 'src/lib/**/*.ts',
    excludePatterns: ['src/lib/__tests__/**', 'src/lib/supabase/**', '**/*.d.ts'],
  }

  // vitest json-summary format
  function summary(entries: Record<string, number>) {
    const data: Record<string, { lines: { pct: number } }> = {}
    for (const [file, pct] of Object.entries(entries)) {
      data[file] = { lines: { pct } }
    }
    return data
  }

  it('passes when all changed files exceed threshold', () => {
    const changed = ['src/lib/data.ts']
    const coverage = summary({
      'C:/proj/src/lib/data.ts': 95,
    })
    const res = validateCoverage(changed, coverage, cfg)
    expect(res.ok).toBe(true)
  })

  it('fails when a changed file is below threshold', () => {
    const changed = ['src/lib/data.ts']
    const coverage = summary({
      'C:/proj/src/lib/data.ts': 50,
    })
    const res = validateCoverage(changed, coverage, cfg)
    expect(res.ok).toBe(false)
    expect(res.violations).toHaveLength(1)
    expect(res.violations[0].file).toMatch(/data\.ts/)
    expect(res.violations[0].coverage).toBe(50)
  })

  it('ignores files not in include pattern', () => {
    const changed = ['src/components/footer.tsx', 'src/app/page.tsx']
    const coverage = summary({})
    const res = validateCoverage(changed, coverage, cfg)
    expect(res.ok).toBe(true)
  })

  it('ignores excluded files', () => {
    const changed = ['src/lib/supabase/client.ts']
    const coverage = summary({})
    const res = validateCoverage(changed, coverage, cfg)
    expect(res.ok).toBe(true)
  })

  it('fails when coverage data missing for changed lib file', () => {
    const changed = ['src/lib/new-util.ts']
    const coverage = summary({})
    const res = validateCoverage(changed, coverage, cfg)
    expect(res.ok).toBe(false)
    expect(res.violations[0].reason).toBe('missing')
  })

  it('matches coverage keys using substring (handles absolute paths)', () => {
    const changed = ['src/lib/data.ts']
    const coverage = summary({
      'C:/dev/ai-place/src/lib/data.ts': 85,
    })
    const res = validateCoverage(changed, coverage, cfg)
    expect(res.ok).toBe(true)
  })

  it('reports multiple violations', () => {
    const changed = ['src/lib/a.ts', 'src/lib/b.ts', 'src/lib/c.ts']
    const coverage = summary({
      'path/to/src/lib/a.ts': 90,
      'path/to/src/lib/b.ts': 60,
      'path/to/src/lib/c.ts': 30,
    })
    const res = validateCoverage(changed, coverage, cfg)
    expect(res.ok).toBe(false)
    expect(res.violations).toHaveLength(2)
  })
})
