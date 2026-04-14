import { describe, it, expect } from 'vitest'

describe('Supabase Client', () => {
  it('should export createClient function', async () => {
    const { createClient } = await import('@/lib/supabase/client')
    expect(createClient).toBeDefined()
    expect(typeof createClient).toBe('function')
  })

  it('should export createServerClient function', async () => {
    const { createServerClient } = await import('@/lib/supabase/server')
    expect(createServerClient).toBeDefined()
    expect(typeof createServerClient).toBe('function')
  })
})

describe('Supabase Database Types', () => {
  it('should export Database type', async () => {
    // Database type should be importable (compile-time check)
    const mod = await import('@/lib/supabase/database.types')
    expect(mod).toBeDefined()
  })
})
