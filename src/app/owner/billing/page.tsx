// Sprint O-1 / T-204 — 오너 결제·플랜 페이지.
// 1) 파일럿 / 구독 상태 카드
// 2) 카드 상태 + 등록/변경 버튼 (Toss 인증 시작)
// 3) 최근 결제 이력
// 4) 해지 링크

import Link from 'next/link'
import type { Metadata } from 'next'
import { requireOwnerUser } from '@/lib/owner/auth'
import { loadOwnerBillingState, type OwnerBillingState } from '@/lib/owner/billing-state'
import { getTossClientKey, isUsingTossTestKey } from '@/lib/billing/toss'
import { STANDARD_PLAN_AMOUNT } from '@/lib/billing/types'
import { composePageTitle } from '@/lib/seo/compose-title'
import { PageHeader } from '../_components/page-header'
import { BillingAuthButton } from './_components/billing-auth-button'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export const metadata: Metadata = {
  title: composePageTitle('결제·플랜'),
  description: '카드 등록·변경·해지 및 결제 이력을 확인합니다.',
  robots: { index: false, follow: false },
}

interface Params {
  searchParams: Promise<{
    success?: string
    registered?: string
    code?: string
    message?: string
  }>
}

function formatAmount(won: number): string {
  return `${won.toLocaleString('ko-KR')}원`
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

function expiryLabel(year: number | null, month: number | null): string {
  if (year == null || month == null) return '—'
  return `${String(month).padStart(2, '0')}/${String(year).slice(-2)}`
}

export default async function OwnerBillingPage({ searchParams }: Params) {
  const user = await requireOwnerUser('/owner/billing')
  const params = await searchParams
  const state = await loadOwnerBillingState(user.id)
  const clientKey = getTossClientKey()
  const isTest = isUsingTossTestKey()

  return (
    <>
      {params.success && (
        <div className="owner-banner ok" role="status">
          <span>✅ 카드가 등록됐습니다. 파일럿 종료 후 자동 결제로 전환됩니다.</span>
        </div>
      )}
      {params.code && (
        <div className="owner-banner danger" role="alert">
          <span>⚠️ 카드 등록 실패 · {params.message ?? params.code}</span>
        </div>
      )}

      <PageHeader
        title={<>결제 <em>·</em> 플랜</>}
        subtitle="파일럿 · 카드 · 자동 결제 이력을 한눈에 관리합니다."
        back={{ href: '/owner', label: '대시보드' }}
        actions={isTest ? (
          <span className="chip" style={{ background: 'var(--bg-2)', color: 'var(--muted)' }}>테스트 키 사용 중</span>
        ) : undefined}
      />

      <section className="kpi-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
        <PilotCard state={state} />
        <SubscriptionCard state={state} />
      </section>

      <section className="row">
        <CardPanel state={state} clientKey={clientKey} />
        <PaymentHistoryPanel state={state} />
      </section>
    </>
  )
}

// ── 파일럿 KPI ──────────────────────────────────────────────────
function PilotCard({ state }: { state: OwnerBillingState }) {
  const { customer, pilotRemainingDays } = state
  if (!customer) {
    return (
      <article className="kpi">
        <span className="k">파일럿</span>
        <div className="v">—</div>
        <div className="sub">가입 후 파일럿 정보가 생성됩니다.</div>
      </article>
    )
  }
  const ended = pilotRemainingDays < 0
  const used = Math.min(30, Math.max(0, 30 - pilotRemainingDays))
  const pct = Math.max(0, Math.min(100, (used / 30) * 100))

  return (
    <article className="kpi">
      <span className="k">파일럿 30일</span>
      <div className="v">
        {ended ? '종료' : `D+${used}`}
        <span className="u">/ 30일</span>
      </div>
      <div className="sub">
        {ended
          ? '파일럿이 종료됐습니다. 카드를 등록하면 자동 결제가 시작됩니다.'
          : `잔 ${pilotRemainingDays}일 · 종료: ${formatDate(customer.trialEndsAt)}`}
      </div>
      <div className="progress-bar" aria-hidden>
        <div style={{ width: `${pct}%` }} />
      </div>
    </article>
  )
}

// ── 구독 KPI ──────────────────────────────────────────────────
function SubscriptionCard({ state }: { state: OwnerBillingState }) {
  const s = state.subscription
  if (!s) {
    return (
      <article className="kpi">
        <span className="k">구독</span>
        <div className="v">미시작</div>
        <div className="sub">카드 등록 시 월 {formatAmount(STANDARD_PLAN_AMOUNT)} 자동 결제가 준비됩니다.</div>
      </article>
    )
  }
  const statusLabel: Record<string, { label: string; tone: string }> = {
    pending:                { label: '카드 등록 완료 · 결제 대기', tone: 'muted' },
    active:                 { label: '활성',                        tone: 'ok' },
    past_due:               { label: '결제 실패 · 재시도 중',        tone: 'warn' },
    pending_cancellation:   { label: '해지 예약',                   tone: 'warn' },
    suspended:              { label: '정지',                        tone: 'danger' },
    canceled:               { label: '해지됨',                      tone: 'muted' },
  }
  const sl = statusLabel[s.status] ?? { label: s.status, tone: 'muted' }

  return (
    <article className="kpi">
      <span className="k">구독 · {s.plan}</span>
      <div className="v">
        {formatAmount(s.amount)}
        <span className="u">/ 월</span>
      </div>
      <div className="sub">
        상태: <b style={{ color: 'var(--ink)' }}>{sl.label}</b>
        {s.nextChargeAt && ` · 다음 결제 ${formatDate(s.nextChargeAt)}`}
      </div>
      {s.failedRetryCount > 0 && (
        <div className="info-note">재시도 {s.failedRetryCount}회</div>
      )}
    </article>
  )
}

// ── 카드 패널 ──────────────────────────────────────────────────
function CardPanel({ state, clientKey }: { state: OwnerBillingState; clientKey: string }) {
  const customer = state.customer
  const card = state.billingKey

  return (
    <div className="dash-panel">
      <div className="head">
        <h3>결제 카드</h3>
        {card && <span className="chip good">등록 완료</span>}
        {!card && <span className="chip accent">카드 미등록</span>}
      </div>

      {!customer ? (
        <div className="form-inline-info">
          고객 정보가 아직 없습니다. 문제가 지속되면 support@aiplace.kr 로 문의해 주세요.
        </div>
      ) : card ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{
            background: 'linear-gradient(135deg, #1a1a1a, #2a2a2a)',
            color: '#fff', padding: 20, borderRadius: 'var(--r-md)',
            display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            <div style={{ fontSize: 12, fontFamily: 'var(--mono)', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.6)' }}>
              {card.cardCompany ?? '카드'} {card.cardType ? `· ${card.cardType}` : ''}
            </div>
            <div style={{ fontSize: 20, fontFamily: 'var(--mono)', letterSpacing: '0.1em' }}>
              {card.cardNumberMasked ?? '**** **** **** ****'}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontFamily: 'var(--mono)', color: 'rgba(255,255,255,0.8)' }}>
              <span>유효기간 {expiryLabel(card.expiryYear, card.expiryMonth)}</span>
              <span>{card.method ?? '카드'}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <BillingAuthButton
              clientKey={clientKey}
              customerKey={customer.id}
              hasActiveCard={true}
            />
            <Link href="/owner/billing/cancel" className="btn ghost">구독 해지</Link>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-inline-info">
            <b style={{ color: 'var(--ink)' }}>파일럿 기간 중에도 카드를 미리 등록할 수 있습니다.</b>
            <div style={{ marginTop: 6, fontSize: 12 }}>
              카드 등록 시점엔 결제가 일어나지 않으며, 파일럿 종료({formatDate(customer.trialEndsAt)}) 에
              첫 월 {formatAmount(STANDARD_PLAN_AMOUNT)} 이 자동 결제됩니다.
            </div>
          </div>
          <BillingAuthButton
            clientKey={clientKey}
            customerKey={customer.id}
            hasActiveCard={false}
          />
          <div style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>
            ※ 카드는 Toss 에 토큰으로 안전하게 저장됩니다. aiplace 서버는 카드 번호를 저장하지 않습니다.
          </div>
        </div>
      )}
    </div>
  )
}

// ── 결제 이력 ──────────────────────────────────────────────────
function PaymentHistoryPanel({ state }: { state: OwnerBillingState }) {
  const list = state.recentPayments
  return (
    <div className="dash-panel">
      <div className="head">
        <h3>최근 결제 이력</h3>
        {list.length > 0 && <span className="chip muted">최근 5건</span>}
      </div>

      {list.length === 0 ? (
        <div style={{ padding: 24, color: 'var(--muted)', fontSize: 13.5, textAlign: 'center' }}>
          아직 결제 이력이 없습니다. 파일럿 기간이 끝나면 자동 결제 기록이 생성됩니다.
        </div>
      ) : (
        <table className="bot-table">
          <thead>
            <tr>
              <th>상태</th>
              <th>금액</th>
              <th>메모</th>
              <th>시각</th>
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id}>
                <td>
                  <span
                    className="type-chip"
                    style={
                      p.status === 'succeeded'
                        ? { background: 'color-mix(in oklab, var(--good) 14%, transparent)', color: 'var(--good)' }
                        : p.status === 'failed'
                        ? { background: 'color-mix(in oklab, #c24b2f 14%, transparent)', color: '#9a2c00' }
                        : { background: 'var(--bg-2)', color: 'var(--muted)' }
                    }
                  >
                    {p.status === 'succeeded' ? '성공' : p.status === 'failed' ? '실패' : p.status}
                  </span>
                </td>
                <td className="eng">{formatAmount(p.amount)}</td>
                <td className="path" style={{ maxWidth: 260 }}>
                  {p.pgResponseMessage ?? '—'}
                  {p.retriedCount > 0 && ` · 재시도 ${p.retriedCount}`}
                </td>
                <td className="ts">{formatDate(p.succeededAt ?? p.attemptedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
