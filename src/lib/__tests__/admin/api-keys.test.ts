import { describe, it, expect, afterEach } from 'vitest'
import { maskKey, getApiKeyInfo, groupApiKeys } from '@/lib/admin/api-keys'

describe('maskKey', () => {
  it('정상 마스킹', () => {
    expect(maskKey('test_sk_12345678901234567890')).toBe('test••••7890')
  })

  it('짧은 키 → 전부 마스킹', () => {
    expect(maskKey('abc')).toBe('••••')
    expect(maskKey('abcdef')).toBe('••••')
  })

  it('null/undefined/빈값 → null', () => {
    expect(maskKey(null)).toBeNull()
    expect(maskKey(undefined)).toBeNull()
    expect(maskKey('')).toBeNull()
    expect(maskKey('   ')).toBeNull()
  })
})

describe('getApiKeyInfo', () => {
  const ORIGINAL = process.env.OPENAI_API_KEY

  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.OPENAI_API_KEY
    else process.env.OPENAI_API_KEY = ORIGINAL
  })

  it('key 존재 시 present=true + masked', () => {
    process.env.OPENAI_API_KEY = 'sk-abcdef1234567890'
    const info = getApiKeyInfo()
    const openai = info.find(k => k.envVar === 'OPENAI_API_KEY')
    expect(openai?.present).toBe(true)
    expect(openai?.masked).toContain('••••')
  })

  it('key 없을 시 present=false + masked=null', () => {
    delete process.env.OPENAI_API_KEY
    const info = getApiKeyInfo()
    const openai = info.find(k => k.envVar === 'OPENAI_API_KEY')
    expect(openai?.present).toBe(false)
    expect(openai?.masked).toBeNull()
  })

  it('주요 키 정의 포함', () => {
    const info = getApiKeyInfo()
    const envs = info.map(k => k.envVar)
    expect(envs).toContain('ANTHROPIC_API_KEY')
    expect(envs).toContain('TOSS_SECRET_KEY')
    expect(envs).toContain('SUPABASE_SERVICE_ROLE_KEY')
  })
})

describe('groupApiKeys', () => {
  it('present/missing 분리', () => {
    const r = groupApiKeys([
      { name: 'A', envVar: 'A', present: true, masked: '••', usedBy: '' },
      { name: 'B', envVar: 'B', present: false, masked: null, usedBy: '' },
    ])
    expect(r.present).toHaveLength(1)
    expect(r.missing).toHaveLength(1)
  })
})

