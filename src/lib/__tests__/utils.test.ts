import { describe, it, expect } from 'vitest'
import { cn, safeJsonLd } from '@/lib/utils'

describe('cn', () => {
  it('should merge class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('should handle conditional classes', () => {
    expect(cn('base', false && 'hidden', 'visible')).toBe('base visible')
  })

  it('should merge tailwind conflicts', () => {
    expect(cn('p-4', 'p-6')).toBe('p-6')
  })
})

describe('safeJsonLd', () => {
  it('should escape </script> to prevent XSS', () => {
    const data = { name: 'test</script><script>alert(1)</script>' }
    const result = safeJsonLd(data)
    expect(result).not.toContain('</script>')
    expect(result).toContain('\\u003c')
  })

  it('should produce valid JSON when parsed back', () => {
    const data = { name: '테스트', value: 42 }
    const result = safeJsonLd(data)
    // \\u003c is valid JSON, so JSON.parse should work
    const parsed = JSON.parse(result)
    expect(parsed.name).toBe('테스트')
    expect(parsed.value).toBe(42)
  })
})
