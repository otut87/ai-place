// T-195 — Medical/Legal/Tax Compliance Checker (Haiku) / Phase 3.
// sector ∈ (medical, legal, tax) 만 실행.
// banned-phrases.ts 의 MEDICAL_FORBIDDEN / LEGAL_FORBIDDEN / TAX_FORBIDDEN 결정론 1차 필터 + Haiku 가 2차 맥락 판별.

import {
  MEDICAL_FORBIDDEN,
  LEGAL_FORBIDDEN,
  TAX_FORBIDDEN,
} from '@/lib/blog/banned-phrases'

const APPLICABLE_SECTORS = new Set(['medical', 'legal', 'tax'])

export interface MedicalLawCheckerInput {
  sector: string
  content: string
  faqs: Array<{ question: string; answer: string }>
  apiKey?: string
}

export interface ComplianceIssue {
  severity: 'fail' | 'warn'
  phrase: string
  reason: string
  suggestion: string
}

export interface MedicalLawCheckerOutput {
  applicable: boolean             // false = sector 해당 없음 → skip
  issues: ComplianceIssue[]
  disclaimerNeeded: boolean       // 면책 문구 자동 삽입 여부
  tokensUsed: { input: number; output: number }
  latencyMs: number
}

const TOOL_SCHEMA = {
  type: 'object' as const,
  properties: {
    issues: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          severity: { type: 'string', enum: ['fail', 'warn'] },
          phrase: { type: 'string', description: '문제 표현 원문' },
          reason: { type: 'string', description: '어떤 규제/법령을 위반하는지' },
          suggestion: { type: 'string', description: '대체 표현 제안' },
        },
        required: ['severity', 'phrase', 'reason', 'suggestion'],
        additionalProperties: false,
      },
    },
    disclaimerNeeded: { type: 'boolean' },
  },
  required: ['issues', 'disclaimerNeeded'],
  additionalProperties: false,
}

function sectorBanned(sector: string): string[] {
  if (sector === 'medical') return MEDICAL_FORBIDDEN
  if (sector === 'legal') return LEGAL_FORBIDDEN
  if (sector === 'tax') return TAX_FORBIDDEN
  return []
}

function systemFor(sector: string): string {
  if (sector === 'medical') return [
    '당신은 의료광고법·의료법 56조 컴플라이언스 감사관입니다.',
    '블로그 본문에서 "치료 효과 보장", "부작용 없음", "완치", "즉각적 치료" 등 금지 표현을 찾고,',
    '면책 문구(치료 효과 개인차 있음, 의료 진단 아님) 필요 여부를 판단하세요.',
  ].join(' ')
  if (sector === 'legal') return [
    '당신은 변호사법 컴플라이언스 감사관입니다.',
    '"반드시 승소", "100% 성공", 구체 판례 과장 표현을 찾고, 면책 필요 여부 판단.',
  ].join(' ')
  if (sector === 'tax') return [
    '당신은 세무사법 컴플라이언스 감사관입니다.',
    '"반드시 절세", "세금 면제 보장", 구체 수치 절세 과장 표현을 찾고, 면책 필요 여부 판단.',
  ].join(' ')
  return '컴플라이언스 감사관.'
}

export async function checkCompliance(
  input: MedicalLawCheckerInput,
): Promise<MedicalLawCheckerOutput> {
  if (!APPLICABLE_SECTORS.has(input.sector)) {
    return {
      applicable: false,
      issues: [],
      disclaimerNeeded: false,
      tokensUsed: { input: 0, output: 0 },
      latencyMs: 0,
    }
  }

  // 1) 결정론 1차 필터 — 확정 금칙 표현은 Haiku 호출 전에 검출.
  const banned = sectorBanned(input.sector)
  const deterministic: ComplianceIssue[] = []
  for (const phrase of banned) {
    if (input.content.includes(phrase)) {
      deterministic.push({
        severity: 'fail',
        phrase,
        reason: `${input.sector} 금칙 표현 (banned-phrases 상수)`,
        suggestion: '중립 서술로 교체 (예: "개선 가능성 있음", "상담 필요")',
      })
    }
  }

  // 2) Haiku 2차 맥락 판별
  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const client = new Anthropic(input.apiKey ? { apiKey: input.apiKey } : {})

  const start = Date.now()
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: systemFor(input.sector),
    tools: [{
      name: 'compliance_check',
      description: '규제 위반 표현 탐지 + 면책 필요 여부.',
      input_schema: TOOL_SCHEMA,
    }],
    tool_choice: { type: 'tool', name: 'compliance_check' },
    messages: [{
      role: 'user',
      content: [
        `본문:`,
        input.content.slice(0, 2000),
        '',
        `FAQ:`,
        input.faqs.map(f => `- Q: ${f.question}\n  A: ${f.answer}`).join('\n'),
        '',
        `compliance_check 도구 호출.`,
      ].join('\n'),
    }],
  })
  const latencyMs = Date.now() - start

  const toolUse = response.content.find(b => b.type === 'tool_use')
  if (!toolUse || toolUse.type !== 'tool_use') {
    // Haiku 실패 시 결정론 결과만 반환
    return {
      applicable: true,
      issues: deterministic,
      disclaimerNeeded: deterministic.length > 0,
      tokensUsed: { input: response.usage.input_tokens, output: response.usage.output_tokens },
      latencyMs,
    }
  }
  const parsed = toolUse.input as {
    issues: ComplianceIssue[]
    disclaimerNeeded: boolean
  }

  // 결정론 + Haiku 이슈 병합 (phrase 중복 제거)
  const seen = new Set(deterministic.map(d => d.phrase))
  const combined = [...deterministic]
  for (const i of parsed.issues ?? []) {
    if (!seen.has(i.phrase)) {
      combined.push(i)
      seen.add(i.phrase)
    }
  }

  return {
    applicable: true,
    issues: combined,
    disclaimerNeeded: parsed.disclaimerNeeded || deterministic.length > 0,
    tokensUsed: { input: response.usage.input_tokens, output: response.usage.output_tokens },
    latencyMs,
  }
}

/** 면책 문구 — 섹터별 표준 문구. pipeline 에서 content 말미에 자동 추가. */
export function getDisclaimer(sector: string): string {
  if (sector === 'medical') return [
    '',
    '---',
    '**면책**: 본 글은 공개 데이터 기반 자체 조사이며 의료 진단이 아닙니다.',
    '치료 효과는 개인에 따라 다를 수 있으며, 실제 진료는 의료진 상담 후 결정하세요.',
  ].join('\n')
  if (sector === 'legal') return [
    '',
    '---',
    '**면책**: 본 글은 공개 자료 기반이며 법률 자문이 아닙니다.',
    '개별 사안은 변호사 상담이 필요합니다. 변호사법을 준수합니다.',
  ].join('\n')
  if (sector === 'tax') return [
    '',
    '---',
    '**면책**: 본 글은 공개 자료 기반이며 세무 자문이 아닙니다.',
    '실제 세무 처리는 세무사 상담 후 진행하세요. 세무사법을 준수합니다.',
  ].join('\n')
  return ''
}
