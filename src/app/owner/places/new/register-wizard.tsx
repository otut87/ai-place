'use client'

// T-151 — 5단계 업체 등록 마법사.
// 1) 기본정보 → 2) 연락처 → 3) 서비스·태그 → 4) 이미지 → 5) sameAs

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { registerOwnerPlaceAction, type OwnerPlaceDraft } from '@/lib/actions/owner-register-place'
import { AiGenerateButton } from '@/components/owner/ai-generate-button'

type StepName = 'basic' | 'contact' | 'services' | 'images' | 'sameas' | 'review'
const STEPS: StepName[] = ['basic', 'contact', 'services', 'images', 'sameas', 'review']
const STEP_LABELS: Record<StepName, string> = {
  basic: '1. 기본 정보',
  contact: '2. 연락처 · 영업시간',
  services: '3. 서비스 · 태그',
  images: '4. 이미지',
  sameas: '5. 외부 프로필',
  review: '확인 & 등록',
}

interface Props {
  cities: Array<{ slug: string; name: string }>
  categories: Array<{ slug: string; name: string; sector: string }>
}

export function RegisterWizard({ cities, categories }: Props) {
  const [step, setStep] = useState<StepName>('basic')
  const [draft, setDraft] = useState<OwnerPlaceDraft>({
    name: '', city: cities[0]?.slug ?? '', category: '', address: '',
    tags: [], services: [], recommendedFor: [], strengths: [], images: [],
  })
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const router = useRouter()

  function update<K extends keyof OwnerPlaceDraft>(key: K, value: OwnerPlaceDraft[K]) {
    setDraft(d => ({ ...d, [key]: value }))
  }

  function next() {
    setError(null)
    const idx = STEPS.indexOf(step)
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1])
  }
  function prev() {
    const idx = STEPS.indexOf(step)
    if (idx > 0) setStep(STEPS[idx - 1])
  }

  async function submit() {
    setError(null)
    setPending(true)
    const r = await registerOwnerPlaceAction(draft)
    setPending(false)
    if (!r.success) {
      setError(r.error)
      return
    }
    const msg = r.autoApproved
      ? '등록 완료 — 바로 공개됩니다.'
      : '등록 완료 — 관리자 검토 후 공개됩니다.'
    router.push(`/owner/places/${r.placeId}?registered=1&msg=${encodeURIComponent(msg)}`)
    router.refresh()
  }

  return (
    <div className="space-y-5">
      {/* 진행 바 */}
      <div className="flex items-center gap-1">
        {STEPS.map((s, i) => (
          <div key={s}
            className={`h-1.5 flex-1 rounded ${STEPS.indexOf(step) >= i ? 'bg-[#008060]' : 'bg-[#e5e7eb]'}`}
          />
        ))}
      </div>
      <h2 className="text-sm font-semibold text-[#222222]">{STEP_LABELS[step]}</h2>

      {/* 단계별 입력 */}
      {step === 'basic' && (
        <div className="space-y-3">
          <Field label="업체명 *">
            <input value={draft.name} onChange={e => update('name', e.target.value)}
              className="h-10 w-full rounded-lg border border-[#dddddd] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#008060]"
              placeholder="예: 닥터스킨 클리닉" />
          </Field>
          <Field label="도시 *">
            <select value={draft.city} onChange={e => update('city', e.target.value)}
              className="h-10 w-full rounded-lg border border-[#dddddd] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#008060]">
              {cities.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="업종 *">
            <select value={draft.category} onChange={e => update('category', e.target.value)}
              className="h-10 w-full rounded-lg border border-[#dddddd] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#008060]">
              <option value="">선택</option>
              {categories.map(c => <option key={c.slug} value={c.slug}>{c.name} ({c.sector})</option>)}
            </select>
          </Field>
          <Field label="주소 *">
            <input value={draft.address} onChange={e => update('address', e.target.value)}
              className="h-10 w-full rounded-lg border border-[#dddddd] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#008060]"
              placeholder="예: 천안시 서북구 불당동 123-45" />
          </Field>
        </div>
      )}

      {step === 'contact' && (
        <div className="space-y-3">
          <Field label="전화번호">
            <input value={draft.phone ?? ''} onChange={e => update('phone', e.target.value)}
              className="h-10 w-full rounded-lg border border-[#dddddd] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#008060]"
              placeholder="010-0000-0000" />
          </Field>
          <Field label="영업시간" note="예: 평일 9:00-18:00, 토 9:00-13:00, 일 휴무">
            <textarea value={draft.openingHours ?? ''} onChange={e => update('openingHours', e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-[#dddddd] p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#008060]" />
          </Field>
          <Field label="웹사이트">
            <input value={draft.website ?? ''} onChange={e => update('website', e.target.value)}
              className="h-10 w-full rounded-lg border border-[#dddddd] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#008060]"
              placeholder="https://..." />
          </Field>
          <Field label="업체 소개" note="1~2 문단, 핵심 특장점 위주">
            <textarea value={draft.description ?? ''} onChange={e => update('description', e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-[#dddddd] p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#008060]" />
          </Field>
        </div>
      )}

      {step === 'services' && (
        <div className="space-y-3">
          <Field label="태그" note="쉼표로 구분 (예: 여드름, 레이저, 모공)">
            <input
              value={(draft.tags ?? []).join(', ')}
              onChange={e => update('tags', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
              className="h-10 w-full rounded-lg border border-[#dddddd] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#008060]" />
          </Field>
          <Field label="강점" note="쉼표로 구분 (예: 20년 경력, 야간 진료)">
            <input
              value={(draft.strengths ?? []).join(', ')}
              onChange={e => update('strengths', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
              className="h-10 w-full rounded-lg border border-[#dddddd] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#008060]" />
          </Field>
          <Field label="추천 대상" note="쉼표로 구분 (예: 직장인, 학생, 가족)">
            <input
              value={(draft.recommendedFor ?? []).join(', ')}
              onChange={e => update('recommendedFor', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
              className="h-10 w-full rounded-lg border border-[#dddddd] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#008060]" />
          </Field>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
            <p className="mb-2 text-[11px] font-medium text-emerald-900">
              💡 입력이 번거로우면 AI로 자동 채우기 (월 5회 무료)
            </p>
            <AiGenerateButton
              name={draft.name}
              city={draft.city}
              category={draft.category}
              websiteUrl={draft.website}
              mode="initial"
              onAccept={out => {
                update('description', out.description)
                update('tags', out.tags)
                update('services', out.services)
                update('recommendedFor', out.recommendedFor)
                update('strengths', out.strengths)
              }}
            />
          </div>
        </div>
      )}

      {step === 'images' && (
        <div className="space-y-3">
          <Field label="이미지 URL" note="쉼표로 구분. 1장 이상 업로드 시 자동 승인.">
            <textarea
              value={(draft.images ?? []).join('\n')}
              onChange={e => update('images', e.target.value.split('\n').map(s => s.trim()).filter(Boolean))}
              rows={4}
              className="w-full rounded-lg border border-[#dddddd] p-3 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-[#008060]"
              placeholder="https://example.com/1.jpg&#10;https://example.com/2.jpg" />
          </Field>
          <p className="rounded-lg bg-[#e0f2fe] p-2 text-[11px] text-[#075985]">
            ℹ️ 이미지 업로더는 추후 추가 예정 — 우선 URL 붙여넣기로 진행.
          </p>
        </div>
      )}

      {step === 'sameas' && (
        <div className="space-y-3">
          <Field label="네이버 플레이스 URL">
            <input value={draft.naverPlaceUrl ?? ''} onChange={e => update('naverPlaceUrl', e.target.value)}
              className="h-10 w-full rounded-lg border border-[#dddddd] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#008060]"
              placeholder="https://place.map.naver.com/..." />
          </Field>
          <Field label="카카오맵 URL">
            <input value={draft.kakaoMapUrl ?? ''} onChange={e => update('kakaoMapUrl', e.target.value)}
              className="h-10 w-full rounded-lg border border-[#dddddd] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#008060]"
              placeholder="https://place.map.kakao.com/..." />
          </Field>
          <Field label="Google Business Profile URL">
            <input value={draft.googleBusinessUrl ?? ''} onChange={e => update('googleBusinessUrl', e.target.value)}
              className="h-10 w-full rounded-lg border border-[#dddddd] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#008060]"
              placeholder="https://maps.google.com/?cid=..." />
          </Field>
          <p className="rounded-lg bg-[#e0f2fe] p-2 text-[11px] text-[#075985]">
            ℹ️ 최소 1~2개 이상 연결을 권장합니다 (sameAs 엔티티 링크 — AI 인용률 향상).
          </p>
        </div>
      )}

      {step === 'review' && (
        <div className="space-y-2 rounded-lg border border-[#e5e7eb] bg-[#fafafa] p-4 text-sm">
          <p><strong>{draft.name}</strong></p>
          <p className="text-xs text-[#6a6a6a]">
            /{draft.city}/{draft.category} · {draft.address}
          </p>
          <p className="text-xs text-[#6a6a6a]">
            {draft.phone ?? '전화 -'} · 이미지 {draft.images?.length ?? 0}장
          </p>
          <div className="mt-2 rounded bg-white p-2 text-[11px] text-[#484848]">
            {draft.images?.length && draft.phone
              ? '✅ 자동 승인 조건 충족 → 등록 즉시 공개'
              : '⏳ 관리자 검토 후 공개 (1영업일 이내)'}
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex justify-between pt-2">
        <button onClick={prev} disabled={step === 'basic' || pending}
          className="rounded-lg border border-[#dddddd] px-4 py-2 text-xs text-[#484848] hover:bg-[#f0f0f0] disabled:opacity-30">
          이전
        </button>
        {step !== 'review' ? (
          <button onClick={next}
            className="rounded-lg bg-[#008060] px-4 py-2 text-xs text-white hover:bg-[#006e52]">
            다음
          </button>
        ) : (
          <button onClick={submit} disabled={pending}
            className="rounded-lg bg-[#008060] px-4 py-2 text-xs font-medium text-white hover:bg-[#006e52] disabled:opacity-50">
            {pending ? '등록 중...' : '등록하기'}
          </button>
        )}
      </div>
    </div>
  )
}

function Field({ label, note, children }: { label: string; note?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-[#484848]">{label}</label>
      {note && <p className="text-[10px] text-[#9a9a9a]">{note}</p>}
      <div className="mt-1">{children}</div>
    </div>
  )
}
