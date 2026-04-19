'use client'

// T-155·T-156 — AI 자동 입력·수정 버튼 (Diff 뷰 포함).
import { useState } from 'react'
import { ownerGenerateAiAction } from '@/lib/actions/owner-ai-generate'
import type { OwnerAiOutput, RateLimitStatus } from '@/lib/ai/owner-generate'

interface Props {
  placeId?: string
  name: string
  city: string
  category: string
  websiteUrl?: string
  existingFields?: Partial<OwnerAiOutput>
  onAccept: (output: OwnerAiOutput) => void
  mode: 'initial' | 'edit'
}

export function AiGenerateButton(props: Props) {
  const [draft, setDraft] = useState<OwnerAiOutput | null>(null)
  const [rate, setRate] = useState<RateLimitStatus | null>(null)
  const [instruction, setInstruction] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function generate() {
    setError(null)
    setPending(true)
    const r = await ownerGenerateAiAction({
      placeId: props.placeId,
      name: props.name,
      city: props.city,
      category: props.category,
      websiteUrl: props.websiteUrl,
      existingFields: props.mode === 'edit' ? props.existingFields : undefined,
      instruction: props.mode === 'edit' ? instruction : undefined,
    })
    setPending(false)
    if (r.rateLimit) setRate(r.rateLimit)
    if (!r.success) {
      setError(r.error)
      return
    }
    setDraft(r.output)
  }

  function accept() {
    if (draft) {
      props.onAccept(draft)
      setDraft(null)
    }
  }

  if (draft) {
    return (
      <div className="rounded-lg border-2 border-emerald-400 bg-emerald-50 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-emerald-900">
            {props.mode === 'edit' ? '🔄 AI 수정안' : '✨ AI 생성 결과'}
          </h3>
          {rate && (
            <span className="text-[10px] text-emerald-800">
              이번 달 {rate.monthlyUsed}/{rate.monthlyLimit}
            </span>
          )}
        </div>

        {/* Diff 뷰 */}
        {props.mode === 'edit' && props.existingFields && (
          <DiffView before={props.existingFields} after={draft} />
        )}
        {(props.mode === 'initial' || !props.existingFields) && (
          <NewPreview output={draft} />
        )}

        <div className="mt-3 flex gap-2">
          <button
            onClick={accept}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
          >
            적용
          </button>
          <button
            onClick={() => setDraft(null)}
            className="rounded-lg border border-emerald-600 px-3 py-1.5 text-xs text-emerald-700 hover:bg-emerald-100"
          >
            취소
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {props.mode === 'edit' && (
        <div>
          <label className="block text-xs font-medium text-[#484848]">
            수정 지시 (선택)
          </label>
          <input
            value={instruction}
            onChange={e => setInstruction(e.target.value)}
            placeholder="예: 더 친근한 말투로 / 영업시간 강조 / 의료광고법 주의"
            className="mt-1 h-9 w-full rounded-lg border border-[#dddddd] px-3 text-xs focus:outline-none focus:ring-2 focus:ring-[#008060]"
          />
        </div>
      )}
      <button
        onClick={generate}
        disabled={pending || (rate?.allowed === false)}
        className="w-full rounded-lg border-2 border-dashed border-[#008060] px-3 py-2 text-xs font-medium text-[#008060] hover:bg-[#008060]/5 disabled:border-[#dddddd] disabled:text-[#9a9a9a] disabled:cursor-not-allowed"
      >
        {pending ? '생성 중... (5~15초)' : props.mode === 'edit' ? '✨ AI로 다시 쓰기' : '✨ AI로 자동 채우기'}
      </button>

      {rate && !rate.allowed && (
        <div className="rounded bg-amber-50 p-2 text-[10px] text-amber-800">
          {rate.reason === 'weekly'
            ? `⏳ 주간 재시도 제한 — ${rate.remainingHours}시간 후 가능`
            : `🚫 이번 달 한도 소진 (${rate.monthlyUsed}/${rate.monthlyLimit})`}
        </div>
      )}
      {rate && rate.allowed && (
        <p className="text-[10px] text-[#6a6a6a]">이번 달 사용: {rate.monthlyUsed}/{rate.monthlyLimit}회</p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}

function NewPreview({ output }: { output: OwnerAiOutput }) {
  return (
    <div className="space-y-2 text-xs">
      <Row label="설명">{output.description}</Row>
      <Row label="태그">{output.tags.join(', ')}</Row>
      <Row label="추천 대상">{output.recommendedFor.join(', ')}</Row>
      <Row label="강점">{output.strengths.join(', ')}</Row>
      <Row label="서비스">{output.services.length}개 (적용 시 확인)</Row>
    </div>
  )
}

function DiffView({ before, after }: { before: Partial<OwnerAiOutput>; after: OwnerAiOutput }) {
  return (
    <div className="space-y-3 text-xs">
      <DiffRow label="설명" before={before.description ?? ''} after={after.description} />
      <DiffRow label="태그" before={(before.tags ?? []).join(', ')} after={after.tags.join(', ')} />
      <DiffRow label="추천 대상" before={(before.recommendedFor ?? []).join(', ')} after={after.recommendedFor.join(', ')} />
      <DiffRow label="강점" before={(before.strengths ?? []).join(', ')} after={after.strengths.join(', ')} />
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="font-medium text-[#484848]">{label}</p>
      <p className="mt-0.5 text-[#191919]">{children}</p>
    </div>
  )
}

function DiffRow({ label, before, after }: { label: string; before: string; after: string }) {
  const unchanged = before === after
  return (
    <div>
      <p className="font-medium text-[#484848]">{label} {unchanged && <span className="text-[9px] text-[#9a9a9a]">(변경 없음)</span>}</p>
      {!unchanged && (
        <>
          <p className="mt-1 rounded bg-red-50 p-1.5 text-red-900 line-through opacity-70">{before || '(없음)'}</p>
          <p className="mt-1 rounded bg-emerald-50 p-1.5 text-emerald-900">{after}</p>
        </>
      )}
      {unchanged && <p className="mt-0.5 text-[#6a6a6a]">{after}</p>}
    </div>
  )
}
