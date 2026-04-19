// T-Settings — 설정 허브. 아직 편집 UI 가 없는 항목은 안내만.

import { requireAuth } from '@/lib/auth'
import { AdminLink } from '@/components/admin/admin-link'
import {
  BILLING_PRODUCT,
  BILLING_POLICY_TEXTS,
  summarizeBillingCycle,
} from '@/lib/billing/policy'
import { isUsingTossTestKey } from '@/lib/billing/toss'

export const runtime = 'nodejs'

export default async function AdminSettingsPage() {
  await requireAuth()
  const testMode = isUsingTossTestKey()

  return (
    <div className="px-6 py-5">
      <header className="mb-5">
        <h1 className="text-xl font-semibold">설정</h1>
        <p className="mt-1 text-sm text-[#6b6b6b]">결제 정책, 프롬프트 템플릿, 마스터 데이터, API 키.</p>
      </header>

      <section className="mb-6 rounded-xl border border-[#e7e7e7] bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold">결제 정책</h2>
        <dl className="grid grid-cols-[120px_1fr] gap-y-2 text-sm">
          <dt className="text-[#6b6b6b]">상품</dt>
          <dd>{BILLING_PRODUCT.name} · {summarizeBillingCycle()}</dd>
          <dt className="text-[#6b6b6b]">PG</dt>
          <dd>
            토스페이먼츠
            {testMode && <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700">테스트키</span>}
          </dd>
          <dt className="text-[#6b6b6b]">재시도</dt>
          <dd>{BILLING_POLICY_TEXTS.retryPolicy}</dd>
          <dt className="text-[#6b6b6b]">세법 증빙</dt>
          <dd className="text-[#191919]">{BILLING_POLICY_TEXTS.proofOfTax}</dd>
          <dt className="text-[#6b6b6b]">환불</dt>
          <dd className="text-[#6b6b6b]">{BILLING_POLICY_TEXTS.refundRule}</dd>
        </dl>
        <p className="mt-3 text-xs text-[#9a9a9a]">문구는 `src/lib/billing/policy.ts` 상수로 관리됩니다. 어드민 CRUD 는 MVP 이후.</p>
      </section>

      <section className="mb-6 grid gap-3 md:grid-cols-2">
        <SettingsCard
          title="프롬프트 템플릿"
          desc="카테고리별 버전 관리 · 활성화 · A/B 통과율 비교."
          href="/admin/prompts"
          status="활성"
        />
        <SettingsCard
          title="결제 실패 큐"
          desc="재시도 · 카드 재등록 링크 · 일시 중단 처리."
          href="/admin/billing/failures"
          status="활성"
        />
        <SettingsCard
          title="만료 임박 카드"
          desc="30일 · 7일 내 만료 예정 카드 + 자동 안내 발송 이력."
          href="/admin/billing/expiring"
          status="활성"
        />
        <SettingsCard
          title="결제 이력"
          desc="승인·실패·취소 전체 이력 검색."
          href="/admin/billing/history"
          status="활성"
        />
        <SettingsCard title="카테고리 · 지역 마스터" desc="업종 83종 · 도시 seed 기반. 편집 UI 준비 중." status="준비 중" />
        <SettingsCard title="디자인 토큰" desc="OKLch 변수. JSON 업/다운로드 준비 중." status="준비 중" />
        <SettingsCard title="API 키 관리" desc=".env.local 로 관리 중. UI 준비 중." status="준비 중" />
        <SettingsCard title="팀 · 권한" desc="현재 이메일 화이트리스트. 역할 기반은 미정." status="계획" />
      </section>
    </div>
  )
}

function SettingsCard({
  title, desc, href, status,
}: {
  title: string
  desc: string
  href?: string
  status: '활성' | '준비 중' | '계획'
}) {
  const cls =
    status === '활성' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : status === '준비 중' ? 'bg-amber-50 text-amber-700 border-amber-200'
    : 'bg-[#f3f4f6] text-[#6b6b6b] border-[#e7e7e7]'

  const content = (
    <div className={`rounded-xl border bg-white p-4 transition-colors ${href ? 'hover:bg-[#fafafa]' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium text-[#191919]">{title}</h3>
        <span className={`rounded-full border px-2 py-0.5 text-[10px] ${cls}`}>{status}</span>
      </div>
      <p className="mt-2 text-xs text-[#6b6b6b]">{desc}</p>
    </div>
  )

  return href ? <AdminLink href={href}>{content}</AdminLink> : content
}
