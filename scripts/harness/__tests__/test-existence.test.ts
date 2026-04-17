import { describe, it, expect } from 'vitest'
import { validateTestExistence } from '../gates/test-existence'

describe('validateTestExistence', () => {
  const cfg = {
    testDir: 'src/lib/__tests__',
    testSuffix: '.test.ts',
    excludePatterns: [
      'src/lib/types.ts',
      'src/lib/constants.ts',
      'src/lib/supabase/**',
      'src/lib/__tests__/**',
      '**/*.d.ts',
    ],
  }

  function existsInSet(paths: string[]) {
    const set = new Set(paths)
    return (p: string) => set.has(p)
  }

  it('passes when changed src/lib file has corresponding test file', () => {
    const changed = ['src/lib/data.ts']
    const exists = existsInSet(['src/lib/__tests__/data.test.ts'])
    const res = validateTestExistence(changed, cfg, exists)
    expect(res.ok).toBe(true)
  })

  it('fails when changed src/lib file has no test file', () => {
    const changed = ['src/lib/data.ts']
    const exists = existsInSet([])
    const res = validateTestExistence(changed, cfg, exists)
    expect(res.ok).toBe(false)
    expect(res.violations).toHaveLength(1)
    expect(res.violations[0].file).toBe('src/lib/data.ts')
    expect(res.violations[0].expectedTestPath).toBe('src/lib/__tests__/data.test.ts')
  })

  it('ignores files outside src/lib', () => {
    const changed = ['src/app/page.tsx', 'src/components/footer.tsx']
    const exists = existsInSet([])
    const res = validateTestExistence(changed, cfg, exists)
    expect(res.ok).toBe(true)
  })

  it('ignores excluded files (types.ts, constants.ts)', () => {
    const changed = ['src/lib/types.ts', 'src/lib/constants.ts']
    const exists = existsInSet([])
    const res = validateTestExistence(changed, cfg, exists)
    expect(res.ok).toBe(true)
  })

  it('ignores files under supabase/ subdirectory', () => {
    const changed = ['src/lib/supabase/client.ts', 'src/lib/supabase/server.ts']
    const exists = existsInSet([])
    const res = validateTestExistence(changed, cfg, exists)
    expect(res.ok).toBe(true)
  })

  it('ignores test files themselves', () => {
    const changed = ['src/lib/__tests__/foo.test.ts']
    const exists = existsInSet([])
    const res = validateTestExistence(changed, cfg, exists)
    expect(res.ok).toBe(true)
  })

  it('handles nested paths correctly', () => {
    const changed = ['src/lib/format/rating.ts']
    const exists = existsInSet(['src/lib/__tests__/format/rating.test.ts'])
    const res = validateTestExistence(changed, cfg, exists)
    expect(res.ok).toBe(true)
  })

  it('reports multiple violations', () => {
    const changed = ['src/lib/a.ts', 'src/lib/b.ts', 'src/lib/c.ts']
    const exists = existsInSet(['src/lib/__tests__/b.test.ts'])
    const res = validateTestExistence(changed, cfg, exists)
    expect(res.ok).toBe(false)
    expect(res.violations).toHaveLength(2)
  })
})
