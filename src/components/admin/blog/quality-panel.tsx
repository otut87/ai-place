'use client'

// T-193 — Blog 편집기 QualityPanel (Phase 1).
// 16 결정론 룰 실시간 렌더 + 7블록 체크리스트 흡수 (AEO 섹션에 통합).
//
// 입력:
//  - post 메타 (title/summary/content/slug/targetQuery/tags/categoryOrSector/cityName)
//  - allowedPlaceNames (verified + external)
//  - forbiddenPlaceNames (환각 후보, Phase 3 에서 외부 업체 리스트로 주입)
//  - faqs (blog_posts.faqs jsonb)
//
// 렌더:
//  - 상단 총점 (0~100)
//  - 축별 breakdown 배지
//  - 섹션별 (SEO/AEO/GEO/환각·위생/품질) 룰 리스트

import { FileText, AlertTriangle, CheckCircle2, Circle, AlertCircle } from 'lucide-react'
import { scoreBlogPostV2, AXIS_LABEL } from '@/lib/blog/quality-v2'
import type { RuleResult, RuleAxis } from '@/lib/blog/quality-rules'
import { getBlockChecklist } from '@/lib/blog/template'
import type { FAQ } from '@/lib/types'

interface QualityPanelProps {
  title: string
  summary: string
  content: string
  slug: string
  tags?: string[]
  targetQuery?: string | null
  faqs?: FAQ[]
  categoryOrSector?: string
  cityName?: string
  allowedPlaceNames?: string[]
  forbiddenPlaceNames?: string[]
}

const AXIS_ORDER: RuleAxis[] = ['seo', 'aeo', 'geo', 'sanitation', 'quality']

export function QualityPanel(props: QualityPanelProps) {
  const result = scoreBlogPostV2({
    title: props.title,
    summary: props.summary,
    content: props.content,
    slug: props.slug,
    tags: props.tags,
    targetQuery: props.targetQuery,
    faqs: props.faqs,
    categoryOrSector: props.categoryOrSector,
    cityName: props.cityName,
    allowedPlaceNames: props.allowedPlaceNames,
    forbiddenPlaceNames: props.forbiddenPlaceNames,
  })

  const blockChecklist = getBlockChecklist(props.content, props.categoryOrSector)
  const blockPassed = blockChecklist.filter(b => b.status === 'ok').length

  const scoreColor =
    result.score >= 85 ? 'text-[#22aa77]' :
    result.score >= 70 ? 'text-[#d4a84a]' : 'text-[#c26a6a]'

  return (
    <div className="flex flex-col divide-y divide-[#e7e7e7] bg-[#fafafa]">
      {/* 총점 요약 */}
      <div className="p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-[#6b6b6b]">품질 점수</span>
          {result.hardFailures.length > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-sm bg-[#fef2f2] px-1.5 py-0.5 text-[10px] text-[#c26a6a]">
              <AlertTriangle className="h-2.5 w-2.5" /> FAIL {result.hardFailures.length}
            </span>
          ) : result.warnings.length > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-sm bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-800">
              <AlertCircle className="h-2.5 w-2.5" /> WARN {result.warnings.length}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-sm bg-[#f0fdf4] px-1.5 py-0.5 text-[10px] text-[#22aa77]">
              <CheckCircle2 className="h-2.5 w-2.5" /> PASS
            </span>
          )}
        </div>
        <div className="flex items-baseline gap-2">
          <span className={`text-3xl font-bold ${scoreColor}`}>{result.score}</span>
          <span className="text-xs text-[#9a9a9a]">/ 100</span>
          <span className="ml-auto text-[10px] text-[#6b6b6b]">
            본문 {result.lengthCheck.length.toLocaleString()}자
            {!result.lengthCheck.pass && (
              <span className="ml-1 text-[#c26a6a]">(−10점)</span>
            )}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-5 gap-1 text-[10px]">
          {AXIS_ORDER.map(axis => {
            const b = result.breakdown[axis]
            return (
              <div key={axis} className="rounded bg-white px-1.5 py-1 text-center">
                <div className="text-[#6b6b6b]">{AXIS_LABEL[axis]}</div>
                <div className="font-mono font-semibold text-[#191919]">
                  {b.score}<span className="text-[#9a9a9a]">/{b.max}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 축별 섹션 */}
      {AXIS_ORDER.map(axis => (
        <AxisSection
          key={axis}
          axis={axis}
          rules={result.rulesReport.filter(r => r.axis === axis)}
          extra={axis === 'aeo' ? (
            // 7블록 체크리스트 흡수 (AEO 섹션 하단)
            <div className="mt-2 rounded bg-white p-2">
              <div className="mb-1 flex items-center gap-1 text-[10px] text-[#6b6b6b]">
                <FileText className="h-2.5 w-2.5" /> 7블록 ({blockPassed}/7)
              </div>
              <ul className="grid grid-cols-2 gap-0.5">
                {blockChecklist.map(({ block, status }) => (
                  <li key={block.id} className="flex items-center gap-1 text-[10px]">
                    <span
                      className={
                        status === 'ok' ? 'text-[#22aa77]' :
                        status === 'short' ? 'text-[#d4a84a]' : 'text-[#c26a6a]'
                      }
                    >
                      {status === 'ok' ? '●' : status === 'short' ? '◐' : '○'}
                    </span>
                    <span className="truncate text-[#191919]">{block.title}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : undefined}
        />
      ))}
    </div>
  )
}

function AxisSection({
  axis,
  rules,
  extra,
}: {
  axis: RuleAxis
  rules: RuleResult[]
  extra?: React.ReactNode
}) {
  const failed = rules.filter(r => !r.pass).length
  return (
    <section className="p-3">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[11px] font-semibold text-[#191919]">
          {AXIS_LABEL[axis]}
        </span>
        <span className="text-[10px] text-[#9a9a9a]">
          {rules.length - failed}/{rules.length}
        </span>
      </div>
      <ul className="space-y-1">
        {rules.map(r => <RuleRow key={r.id} rule={r} />)}
      </ul>
      {extra}
    </section>
  )
}

function RuleRow({ rule }: { rule: RuleResult }) {
  const icon = rule.pass
    ? <CheckCircle2 className="h-3 w-3 shrink-0 text-[#22aa77]" />
    : rule.severity === 'fail'
    ? <AlertTriangle className="h-3 w-3 shrink-0 text-[#c26a6a]" />
    : <Circle className="h-3 w-3 shrink-0 text-[#d4a84a]" />

  const textColor = rule.pass
    ? 'text-[#6b6b6b]'
    : rule.severity === 'fail'
    ? 'text-[#c26a6a]'
    : 'text-[#a77a2a]'

  return (
    <li className="flex items-start gap-1.5 text-[11px]">
      {icon}
      <span className={`min-w-0 flex-1 ${textColor}`}>{rule.message}</span>
    </li>
  )
}
