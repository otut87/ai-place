// Sprint O-1 / T-204 / T-221~T-228 — 오너 결제·플랜 페이지.
// .ob-page 쉘 + 6개 구독 상태 wire + 다중 카드 리스트 + past-due 배너 + 해지 링크.

import Link from 'next/link'
import type { Metadata } from 'next'
import { requireOwnerUser } from '@/lib/owner/auth'
import { loadOwnerBillingState, type OwnerBillingState, type BillingKeyRow } from '@/lib/owner/billing-state'
import { getTossClientKey, isUsingTossTestKey } from '@/lib/billing/toss'
import { PLAN_AMOUNT_PER_PLACE, calculatePlanAmount } from '@/lib/billing/types'
import { composePageTitle } from '@/lib/seo/compose-title'
import { PilotEndingBanner } from '../_components/pilot-ending-banner'
import { BillingAuthButton } from './_components/billing-auth-button'
import { CardRowActions } from './_components/card-actions'
import { RetryButton } from './_components/retry-button'

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
    need_card?: string
  }>
}

function formatAmount(won: number): string {
  return `₩${won.toLocaleString('ko-KR')}`
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
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
    <div className="ob-page">
      {params.need_card === '1' && state.billingKeys.length === 0 && (
        <div className="ob-state-banner past_due" role="alert">
          <div className="ic">🚫</div>
          <div className="msg">
            <h4>업체 등록 전에 결제 카드를 먼저 등록해 주세요</h4>
            <p>카드 등록 후 30일 파일럿 동안은 무료입니다. 파일럿이 끝나야 첫 결제가 발생합니다.</p>
          </div>
        </div>
      )}
      {params.success && (
        <div className="ob-state-banner canceled" role="status">
          <div className="ic">✓</div>
          <div className="msg">
            <h4>카드가 등록됐습니다</h4>
            <p>파일럿 종료 후 자동 결제로 전환됩니다.</p>
          </div>
        </div>
      )}
      {params.code && (
        <div className="ob-state-banner past_due" role="alert">
          <div className="ic">⚠</div>
          <div className="msg">
            <h4>카드 등록 실패</h4>
            <p>{params.message ?? params.code}</p>
          </div>
        </div>
      )}

      {/* Hero */}
      <Hero state={state} isTest={isTest} />

      {/* 상태별 배너 — past_due / pending_cancellation / canceled */}
      <StateBanner state={state} />

      {/* 파일럿 D-3 예고 — 기존 PilotEndingBanner */}
      {state.customer && state.billingKeys.length > 0 && (
        <PilotEndingBanner
          pilotRemainingDays={state.pilotRemainingDays}
          trialEndsAt={state.customer.trialEndsAt}
          activePlaceCount={state.activePlaceCount}
          hideDetailCta
        />
      )}

      {/* 카드 관리 */}
      <CardSection state={state} clientKey={clientKey} />

      {/* 결제 이력 */}
      <HistorySection state={state} />

      {/* 구독 해지 (T-227) */}
      {state.subscription && state.subscription.status !== 'canceled' && (
        <div className="ob-cancel-link">
          구독을 중단하시겠습니까? <Link href="/owner/billing/cancel">구독 해지 →</Link>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Hero — 상태 요약 + 금액 산출식
// ─────────────────────────────────────────────────────────────────────
function Hero({ state, isTest }: { state: OwnerBillingState; isTest: boolean }) {
  const s = state.subscription
  const activeCount = state.activePlaceCount
  const expectedAmount = calculatePlanAmount(activeCount)
  const amountMismatch = s && s.amount !== expectedAmount && activeCount > 0

  const statusMeta = subscriptionStatusMeta(s?.status ?? 'pending')

  return (
    <section className="ob-hero">
      <div className="hd">
        <div className="eyebrow">
          {isTest ? '테스트 키 사용 중' : '결제 · 플랜'}
        </div>
        <h1>
          결제 <span className="it">·</span> 플랜
        </h1>
        <p className="sub">
          카드 · 파일럿 · 자동 결제 이력을 한 곳에서 관리합니다.
        </p>
        {activeCount > 0 ? (
          <div className="breakdown">
            <span>업체 <b>{activeCount}개</b> × {formatAmount(PLAN_AMOUNT_PER_PLACE)}</span>
            <span>=</span>
            <span className="total">{formatAmount(expectedAmount)}<span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 4 }}>/월</span></span>
          </div>
        ) : (
          <div className="breakdown">
            <span>활성 업체 <b>0개</b> · 결제 대상 없음</span>
          </div>
        )}
        {amountMismatch && (
          <p className="sub" style={{ color: 'var(--warn, #b45309)', marginTop: 8 }}>
            ⚠ 현재 등록 금액({formatAmount(s!.amount)}) 이 예상치와 다릅니다. 다음 결제일에 자동 조정됩니다.
          </p>
        )}
      </div>
      <div>
        <span className={`status-chip ${statusMeta.tone}`}>{statusMeta.label}</span>
        {s?.nextChargeAt && s.status !== 'canceled' && (
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--mono)', textAlign: 'right' }}>
            다음 결제 {formatDate(s.nextChargeAt)}
          </div>
        )}
      </div>
    </section>
  )
}

/**
 * T-224: PG 응답 메시지를 사용자 친화적인 문구로 간단 맵핑.
 *   더 정교한 분류는 src/lib/billing/ classify 모듈이 담당 (미연결 케이스 위한 폴백).
 */
function classifyOwnerFailureMessage(raw: string | null): string {
  if (!raw) return '일시적 오류로 결제가 실패했습니다. 재시도해 보시거나 카드 변경을 고려하세요.'
  const s = raw.toLowerCase()
  if (raw.includes('잔액') || s.includes('balance') || s.includes('fund')) {
    return '카드 잔액이 부족합니다. 다른 카드로 변경하거나 충전 후 재시도해 주세요.'
  }
  if (raw.includes('만료') || s.includes('expired') || s.includes('expiry')) {
    return '카드 유효기간이 만료됐습니다. 새 카드를 등록해 주세요.'
  }
  if (raw.includes('한도') || s.includes('limit')) {
    return '카드 한도 초과입니다. 카드사에 한도 상향을 요청하거나 다른 카드를 등록해 주세요.'
  }
  if (s.includes('invalid') || raw.includes('유효하지') || raw.includes('거부')) {
    return '카드사에서 승인 거부했습니다. 카드사 문의 또는 다른 카드 등록이 필요합니다.'
  }
  return raw
}

function subscriptionStatusMeta(status: string): { label: string; tone: string } {
  switch (status) {
    case 'active':                return { label: '활성', tone: 'active' }
    case 'past_due':              return { label: '결제 실패 · 재시도 중', tone: 'warn' }
    case 'pending_cancellation':  return { label: '해지 예약', tone: 'warn' }
    case 'canceled':              return { label: '해지됨', tone: 'pending' }
    case 'suspended':             return { label: '정지', tone: 'danger' }
    case 'pending':
    default:                      return { label: '카드 등록 · 결제 대기', tone: 'pending' }
  }
}

// ─────────────────────────────────────────────────────────────────────
// State banner — past_due / pending_cancellation / canceled 안내
// ─────────────────────────────────────────────────────────────────────
function StateBanner({ state }: { state: OwnerBillingState }) {
  const s = state.subscription
  if (!s) return null

  if (s.status === 'past_due') {
    const lastFail = state.recentPayments.find((p) => p.status === 'failed')
    const failureMessage = classifyOwnerFailureMessage(lastFail?.pgResponseMessage ?? null)
    return (
      <div className="ob-state-banner past_due" role="alert">
        <div className="ic">⚠</div>
        <div className="msg">
          <h4>결제가 실패했습니다</h4>
          <p>
            <b>{failureMessage}</b>
            <br />
            자동 재시도 {s.failedRetryCount}회 진행 중
            {s.nextChargeAt && ` · 다음 자동 재시도: ${formatDate(s.nextChargeAt)}`}
          </p>
        </div>
        <div className="actions">
          <RetryButton subscriptionId={s.id} />
          <Link href="#card-section" className="ghost">카드 변경</Link>
        </div>
      </div>
    )
  }

  if (s.status === 'pending_cancellation') {
    return (
      <div className="ob-state-banner pending_cancellation" role="status">
        <div className="ic">⏸</div>
        <div className="msg">
          <h4>해지 예정 상태</h4>
          <p>현재 주기 종료({formatDate(s.nextChargeAt)}) 시점에 구독이 해지됩니다. 그 전까지 기능은 그대로 이용할 수 있습니다.</p>
        </div>
      </div>
    )
  }

  if (s.status === 'canceled') {
    return (
      <div className="ob-state-banner canceled" role="status">
        <div className="ic">□</div>
        <div className="msg">
          <h4>구독이 종료되었습니다</h4>
          <p>재구독하시려면 카드 등록 후 새 업체를 등록하세요.</p>
        </div>
      </div>
    )
  }

  return null
}

// ─────────────────────────────────────────────────────────────────────
// Card section — 다중 카드 리스트 + 추가
// ─────────────────────────────────────────────────────────────────────
function CardSection({ state, clientKey }: { state: OwnerBillingState; clientKey: string }) {
  const customer = state.customer
  const cards = state.billingKeys

  if (!customer) {
    return (
      <section className="ob-sec" id="card-section">
        <div className="hd"><h3>결제 카드</h3></div>
        <div className="ob-empty">
          <div className="ic">⚙</div>
          <h4>고객 정보가 아직 없습니다</h4>
          <p>문제가 지속되면 support@aiplace.kr 로 문의해 주세요.</p>
        </div>
      </section>
    )
  }

  return (
    <section className="ob-sec" id="card-section">
      <div className="hd">
        <h3>결제 카드</h3>
        <span className="sub">
          {cards.length === 0 ? '등록된 카드 없음' : `${cards.length}장 · primary 1장`}
        </span>
      </div>

      {cards.length === 0 ? (
        <div className="ob-empty">
          <div className="ic">💳</div>
          <h4>아직 결제 수단이 없습니다</h4>
          <p>
            파일럿 30일 동안은 과금되지 않습니다.
            카드는 Toss 에 토큰으로 안전하게 저장되며 aiplace 서버는 카드 번호를 저장하지 않습니다.
          </p>
          <BillingAuthButton clientKey={clientKey} customerKey={customer.id} hasActiveCard={false} />
        </div>
      ) : (
        <>
          <div className="ob-card-list">
            {cards.map((c) => (
              <CardRow key={c.id} card={c} isOnlyCard={cards.length === 1} />
            ))}
          </div>
          <BillingAuthButton clientKey={clientKey} customerKey={customer.id} hasActiveCard={true} />
        </>
      )}
    </section>
  )
}

function CardRow({ card, isOnlyCard }: { card: BillingKeyRow; isOnlyCard: boolean }) {
  const brand = (card.cardCompany ?? '카드').slice(0, 6)
  return (
    <div className={`ob-card-row${card.isPrimary ? ' primary' : ''}`}>
      <div className="brand">{brand}</div>
      <div>
        <div className="num">
          {card.cardNumberMasked ?? '**** **** **** ****'}
          {card.isPrimary && <span className="badge-primary">기본</span>}
        </div>
        <div className="meta">
          {card.cardType && <span>{card.cardType} · </span>}
          <span>유효기간 <b>{expiryLabel(card.expiryYear, card.expiryMonth)}</b></span>
          <span> · 등록일 <b>{formatDate(card.authenticatedAt)}</b></span>
        </div>
      </div>
      <CardRowActions keyId={card.id} isPrimary={card.isPrimary} isOnlyCard={isOnlyCard} />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// History — 결제 이력
// ─────────────────────────────────────────────────────────────────────
function HistorySection({ state }: { state: OwnerBillingState }) {
  const list = state.recentPayments
  return (
    <section className="ob-sec">
      <div className="hd">
        <h3>최근 결제 이력</h3>
        {list.length > 0 && <span className="sub">최근 {list.length}건</span>}
      </div>

      {list.length === 0 ? (
        <div className="ob-history">
          <div className="empty">아직 결제 이력이 없습니다. 파일럿 기간이 끝나면 자동 결제 기록이 생깁니다.</div>
        </div>
      ) : (
        <div className="ob-history">
          {list.map((p) => (
            <div className="row" key={p.id}>
              <span className={`stat ${p.status === 'succeeded' ? 'ok' : p.status === 'failed' ? 'fail' : ''}`}>
                {p.status === 'succeeded' ? '성공' : p.status === 'failed' ? '실패' : p.status}
              </span>
              <span className="msg">
                {p.pgResponseMessage ?? '—'}
                {p.retriedCount > 0 && ` · 재시도 ${p.retriedCount}`}
              </span>
              <span className="amount">{formatAmount(p.amount)}</span>
              <span className="date">{formatDate(p.succeededAt ?? p.attemptedAt)}</span>
              <span className="receipt">
                {p.receiptUrl ? (
                  <a href={p.receiptUrl} target="_blank" rel="noopener noreferrer" title="Toss 영수증 열기">
                    영수증 ↗
                  </a>
                ) : null}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
