// T-210 — /owner/places 업체 관리 (CRUD 허브).
// 본인 소유 업체 목록 + status 배지 + 액션 4개 (편집·대시보드·공개 페이지·보관/복원).
// 하단: "+ 업체 추가" CTA. 파일럿(1곳) 이상이면 업체 추가 시 ₩14,900/월 증액 안내.

import type { Metadata } from 'next'
import Link from 'next/link'
import { requireOwnerUser } from '@/lib/owner/auth'
import { listOwnerPlaces } from '@/lib/actions/owner-places'
import { composePageTitle } from '@/lib/seo/compose-title'
import { EmptyState } from '../_components/empty-state'
import { loadAeoSnapshotsForPlaces } from '@/lib/owner/aeo-snapshot'
import { PLAN_AMOUNT_PER_PLACE } from '@/lib/billing/types'
import { PlaceRowActions } from './_components/place-row-actions'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: composePageTitle('업체 관리'),
  description: '내가 등록한 업체를 편집·대시보드 이동·보관 처리할 수 있습니다.',
  robots: { index: false, follow: false },
}

type StatusKind = 'active' | 'archived' | 'pending' | 'rejected' | 'other'

function classifyStatus(s: string): StatusKind {
  if (s === 'active') return 'active'
  if (s === 'archived') return 'archived'
  if (s === 'pending' || s === 'pending_review') return 'pending'
  if (s === 'rejected') return 'rejected'
  return 'other'
}

function statusLabel(s: StatusKind): { text: string; tone: 'good' | 'muted' | 'warn' | 'bad' } {
  switch (s) {
    case 'active':   return { text: '공개 중',     tone: 'good' }
    case 'archived': return { text: '보관됨',       tone: 'muted' }
    case 'pending':  return { text: '검수 대기',    tone: 'warn' }
    case 'rejected': return { text: '등록 반려',    tone: 'bad' }
    default:         return { text: '확인 필요',    tone: 'warn' }
  }
}

export default async function OwnerPlacesPage() {
  await requireOwnerUser()
  const places = await listOwnerPlaces()

  const activeCount = places.filter((p) => p.status === 'active').length
  const archivedCount = places.filter((p) => p.status === 'archived').length
  const placeIds = places.map((p) => p.id)
  const aeoSnapshots = placeIds.length > 0
    ? await loadAeoSnapshotsForPlaces(placeIds.filter((id) => {
        const p = places.find((pl) => pl.id === id)
        return p?.status === 'active'
      }))
    : []
  const aeoByPlaceId = new Map(aeoSnapshots.map((s) => [s.placeId, s]))

  const monthlyAmount = activeCount * PLAN_AMOUNT_PER_PLACE

  return (
    <div className="places-page">
      <div className="crumb">
        <Link href="/owner">← 대시보드</Link>
        <span>/</span>
        <span>업체 관리</span>
      </div>

      <section className="places-hero">
        <div className="left">
          <p className="kicker">내 업체</p>
          <h1>
            등록된 <span className="serif">{places.length}곳</span>
            {archivedCount > 0 && <small> · 보관 {archivedCount}곳</small>}
          </h1>
          <p className="lede">
            공개 중 <b>{activeCount}곳</b> · 월 <b>₩{monthlyAmount.toLocaleString('ko-KR')}</b>
            {' '}(업체당 ₩{PLAN_AMOUNT_PER_PLACE.toLocaleString('ko-KR')} 기준).
            {activeCount === 0 && ' 파일럿 기간이거나 활성 업체가 없어 결제 발생 안 함.'}
          </p>
        </div>
        <div className="right">
          <Link href="/owner/places/new" className="btn accent">
            + 업체 추가
          </Link>
        </div>
      </section>

      {places.length === 0 ? (
        <EmptyState
          eyebrow="· · · 아직 등록된 업체가 없어요 · · ·"
          title={<>첫 업체를 <em>등록</em>해 볼까요?</>}
          description="업체명을 검색하면 네이버·Google 에서 기본 정보가 자동으로 채워져요. 30초면 끝 · AI 최적화 프로필은 등록 직후 자동 생성됩니다."
          action={{ href: '/owner/places/new', label: '+ 업체 등록 시작 →', variant: 'accent' }}
        />
      ) : (
        <div className="places-list">
          {places.map((p) => {
            const kind = classifyStatus(p.status)
            const sl = statusLabel(kind)
            const aeo = aeoByPlaceId.get(p.id)
            const publicUrl = `/${p.city}/${p.category}/${p.slug}`

            return (
              <article key={p.id} className={`place-card place-card-${kind}`}>
                <div className="main">
                  <div className="head">
                    <h3>{p.name}</h3>
                    <span className={`status-chip status-${sl.tone}`}>{sl.text}</span>
                  </div>
                  <div className="meta">
                    <span className="path">{publicUrl}</span>
                    {p.updated_at && (
                      <span className="updated">
                        · 최근 수정 {new Date(p.updated_at).toLocaleDateString('ko-KR')}
                      </span>
                    )}
                  </div>
                  {aeo && (
                    <div className="aeo-mini">
                      <span className="grade">{aeo.grade}</span>
                      <span>AI 가독성 <b>{aeo.score}</b><small>/100</small></span>
                      {aeo.topIssues.length > 0 && (
                        <span className="issues-hint">
                          · 개선 {aeo.topIssues.length}건
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="actions">
                  <Link className="btn ghost sm" href={`/owner/places/${p.id}`}>
                    편집
                  </Link>
                  <Link className="btn ghost sm" href={`/owner/places/${p.id}/dashboard`}>
                    대시보드
                  </Link>
                  <a
                    className="btn ghost sm"
                    href={publicUrl}
                    target="_blank"
                    rel="noreferrer"
                    aria-disabled={kind !== 'active'}
                    style={kind !== 'active' ? { opacity: 0.5, pointerEvents: 'none' } : undefined}
                  >
                    공개 페이지 ↗
                  </a>
                  <PlaceRowActions placeId={p.id} placeName={p.name} status={kind} />
                </div>
              </article>
            )
          })}
        </div>
      )}

      <div className="places-footer-note">
        <b>ⓘ 요금 안내</b> · 월 <b>₩{PLAN_AMOUNT_PER_PLACE.toLocaleString('ko-KR')} / 업체</b> · 업체 추가 시 다음 결제일부터 자동 증액됩니다.
        파일럿 30일 동안은 무료이며, 보관 처리한 업체는 결제 대상에서 제외됩니다.
      </div>

      <style>{`
        .places-page { padding: 24px 0 80px; display: flex; flex-direction: column; gap: 20px; }
        .places-hero {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 20px;
          padding: 28px;
          background: var(--ink, #0f0f0f);
          color: #fff;
          border-radius: var(--r-lg, 14px);
        }
        .places-hero .kicker {
          margin: 0;
          font-size: 12px;
          color: rgba(255,255,255,.6);
          letter-spacing: .08em;
          text-transform: uppercase;
        }
        .places-hero h1 {
          margin: 4px 0 8px;
          font-size: 28px;
          font-weight: 600;
        }
        .places-hero h1 small {
          font-size: 14px;
          color: rgba(255,255,255,.6);
          font-weight: 400;
        }
        .places-hero .serif { font-family: var(--font-serif, Georgia, serif); font-style: italic; }
        .places-hero .lede { margin: 0; font-size: 13px; color: rgba(255,255,255,.78); }
        .places-hero .right .btn.accent {
          background: #fff;
          color: #0f0f0f;
          padding: 10px 18px;
          border-radius: 999px;
          font-weight: 600;
          text-decoration: none;
        }
        @media (max-width: 720px) {
          .places-hero { flex-direction: column; align-items: stretch; }
        }

        .places-list { display: flex; flex-direction: column; gap: 12px; }
        .place-card {
          background: var(--card, #fff);
          border: 1px solid var(--line-2, #e7e5e1);
          border-radius: var(--r-lg, 14px);
          padding: 18px 22px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
        }
        .place-card.place-card-archived {
          opacity: .7;
          background: color-mix(in oklab, var(--line-2, #e7e5e1) 30%, #fff);
        }
        .place-card .main { flex: 1; min-width: 0; }
        .place-card .head { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
        .place-card h3 { margin: 0; font-size: 16px; font-weight: 600; }
        .place-card .meta { font-size: 12px; color: var(--ink-soft, #6b6b6b); }
        .place-card .meta .path { font-family: var(--mono, monospace); }
        .place-card .aeo-mini {
          margin-top: 6px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: var(--ink-soft, #6b6b6b);
        }
        .place-card .aeo-mini .grade {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 22px; height: 22px;
          border-radius: 50%;
          background: var(--ink, #0f0f0f);
          color: #fff;
          font-size: 11px;
          font-weight: 700;
        }
        .place-card .aeo-mini b { color: var(--ink, #0f0f0f); }
        .place-card .aeo-mini .issues-hint { color: var(--warn, #b45309); }
        .place-card .actions {
          display: flex; gap: 6px; flex-wrap: wrap;
          flex-shrink: 0;
        }
        .place-card .actions .btn {
          padding: 6px 12px;
          font-size: 12px;
          border-radius: 8px;
          text-decoration: none;
          border: 1px solid var(--line-2, #e7e5e1);
          color: var(--ink, #0f0f0f);
          background: var(--card, #fff);
        }
        .place-card .actions .btn:hover { background: var(--line-2, #e7e5e1); }

        .status-chip {
          display: inline-flex;
          align-items: center;
          padding: 3px 10px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 600;
        }
        .status-chip.status-good { background: color-mix(in oklab, var(--good, #10a37f) 12%, transparent); color: var(--good, #10a37f); }
        .status-chip.status-muted { background: color-mix(in oklab, #999 18%, transparent); color: #666; }
        .status-chip.status-warn { background: color-mix(in oklab, var(--warn, #b45309) 12%, transparent); color: var(--warn, #b45309); }
        .status-chip.status-bad { background: color-mix(in oklab, var(--bad, #b91c1c) 12%, transparent); color: var(--bad, #b91c1c); }

        .places-footer-note {
          padding: 14px 18px;
          background: color-mix(in oklab, var(--accent, #c09062) 6%, transparent);
          border-left: 3px solid var(--accent, #c09062);
          border-radius: 8px;
          font-size: 13px;
          color: var(--ink, #191919);
        }
        .places-footer-note b { color: var(--ink, #0f0f0f); }

        @media (max-width: 720px) {
          .place-card { flex-direction: column; align-items: stretch; }
        }
      `}</style>
    </div>
  )
}
