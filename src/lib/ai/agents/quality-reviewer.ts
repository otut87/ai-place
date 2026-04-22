// T-195 — Quality Reviewer 에이전트 (Haiku) / Phase 3.
// 입력: draft + quality-v2 rulesReport + hardFailures.
// 출력: writer 에게 줄 rewritePatches (블록 단위 수정 지시).

import type { RuleResult } from '@/lib/blog/quality-rules'

export interface QualityReviewerInput {
  title: string
  summary: string
  content: string
  rulesReport: RuleResult[]
  hardFailures: string[]
  warnings: string[]
  apiKey?: string
}

export interface RewritePatch {
  block: string                   // '결론' / '분석 방법' / '업체별 상세' / ... / 'title' / 'summary'
  instruction: string             // 사람이 읽는 한 줄 지시
}

export interface QualityReviewerOutput {
  issues: string[]                // 감지된 품질 이슈 (사람 가독)
  rewritePatches: RewritePatch[]
  tokensUsed: { input: number; output: number }
  latencyMs: number
}

const TOOL_SCHEMA = {
  type: 'object' as const,
  properties: {
    issues: {
      type: 'array',
      items: { type: 'string' },
      description: '관찰된 품질 이슈 (사람 가독 2~6개)',
    },
    rewritePatches: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          block: {
            type: 'string',
            description: '수정 대상 블록 이름 — "title" / "summary" / "결론" / "분석 방법" / "업체별 상세" / "비교표" / "체크리스트" / "위험 신호" / "자주 묻는 질문"',
          },
          instruction: {
            type: 'string',
            description: '구체 수정 지시 한 줄 (writer 가 그대로 반영)',
          },
        },
        required: ['block', 'instruction'],
        additionalProperties: false,
      },
    },
  },
  required: ['issues', 'rewritePatches'],
  additionalProperties: false,
}

const SYSTEM = `당신은 AI Place 블로그의 Quality Reviewer 입니다.
결정론 룰 엔진(quality-v2)이 산출한 16개 룰 결과를 보고,
writer 에게 전달할 구체 수정 지시(rewritePatches)를 생성하세요.

원칙:
- hardFailures 에 나온 룰부터 최우선 수정.
- warnings 는 덜 중요하지만 1~2개 추가 패치로 다룸.
- 지시는 "무엇을 어떻게 바꿀지" 한 줄로 — 추상적 충고 금지.
- 같은 block 에 여러 이슈면 합쳐서 한 패치로.
- 블록 이름은 위 스키마 enum 중 하나. 알 수 없으면 "summary" 에 묶기.`

function buildPrompt(input: QualityReviewerInput): string {
  const fail = input.rulesReport.filter(r => input.hardFailures.includes(r.id))
  const warn = input.rulesReport.filter(r => input.warnings.includes(r.id))
  return [
    `## 블로그 메타`,
    `제목: ${input.title}`,
    `요약: ${input.summary}`,
    ``,
    `## 본문 (발췌 800자)`,
    input.content.slice(0, 800),
    ``,
    `## 하드 실패 룰 (${fail.length})`,
    ...fail.map(r => `- [${r.id}] ${r.message}`),
    ``,
    `## 경고 룰 (${warn.length})`,
    ...warn.map(r => `- [${r.id}] ${r.message}`),
    ``,
    `review_blog 도구를 호출해 issues 와 rewritePatches 를 반환하세요.`,
  ].join('\n')
}

export async function reviewQuality(input: QualityReviewerInput): Promise<QualityReviewerOutput> {
  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const client = new Anthropic(input.apiKey ? { apiKey: input.apiKey } : {})

  const start = Date.now()
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1536,
    system: SYSTEM,
    tools: [{
      name: 'review_blog',
      description: '룰 위반을 블록별 rewritePatches 로 변환.',
      input_schema: TOOL_SCHEMA,
    }],
    tool_choice: { type: 'tool', name: 'review_blog' },
    messages: [{ role: 'user', content: buildPrompt(input) }],
  })
  const latencyMs = Date.now() - start

  const toolUse = response.content.find(b => b.type === 'tool_use')
  if (!toolUse || toolUse.type !== 'tool_use') {
    throw new Error('quality-reviewer: tool_use 블록 없음')
  }
  const parsed = toolUse.input as { issues: string[]; rewritePatches: RewritePatch[] }

  return {
    issues: parsed.issues ?? [],
    rewritePatches: parsed.rewritePatches ?? [],
    tokensUsed: { input: response.usage.input_tokens, output: response.usage.output_tokens },
    latencyMs,
  }
}
