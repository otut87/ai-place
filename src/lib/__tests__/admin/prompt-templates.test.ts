import { describe, it, expect } from 'vitest'
import { renderTemplate } from '@/lib/admin/prompt-templates'

describe('renderTemplate', () => {
  it('단일 토큰 치환', () => {
    expect(renderTemplate('안녕 {{name}}', { name: '홍길동' })).toBe('안녕 홍길동')
  })

  it('여러 토큰', () => {
    expect(renderTemplate('{{name}} @ {{address}}', { name: '닥터에버스', address: '천안시' }))
      .toBe('닥터에버스 @ 천안시')
  })

  it('공백 포함 토큰', () => {
    expect(renderTemplate('{{ name }}', { name: 'x' })).toBe('x')
  })

  it('undefined → 빈 문자열', () => {
    expect(renderTemplate('{{name}} / {{missing}}', { name: 'x' })).toBe('x / ')
  })

  it('숫자 변환', () => {
    expect(renderTemplate('{{rating}}점', { rating: 4.5 })).toBe('4.5점')
  })

  it('토큰 없음 → 원문 유지', () => {
    expect(renderTemplate('그냥 텍스트', {})).toBe('그냥 텍스트')
  })
})
