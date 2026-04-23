// T-215 — /owner/places 업체 관리 (CRUD 허브). owner.html BUSINESSES VIEW 디자인 이식.
// T-210 에서 세운 "목록 + status 배지 + 액션 4개" 구조는 유지하고,
// 검정 히어로 + 카드형 biz-row (logo · main · AI 가독성 바 · 액션) 으로 리믹스.

import type { Metadata } from 'next'
import Link from 'next/link'
import { requireOwnerUser } from '@/lib/owner/auth'
import { listOwnerPlaces } from '@/lib/actions/owner-places'
import { composePageTitle } from '@/lib/seo/compose-title'
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

function statusBadge(kind: StatusKind): { text: string; cls: string } {
  switch (kind) {
    case 'active':   return { text: '공개 중',  cls: '' }
    case 'pending':  return { text: '검수 중',  cls: 'draft' }
    case 'archived': return { text: '보관됨',    cls: 'off' }
    case 'rejected': return { text: '반려됨',    cls: 'bad' }
    default:         return { text: '확인 필요', cls: 'draft' }
  }
}

// 카테고리 슬러그 → 로고 테마. owner.html 의 derma/food/edu/wellness 에 매핑.
function logoTheme(category: string): 'derma' | 'food' | 'edu' | 'wellness' | 'default' {
  const c = category.toLowerCase()
  if (/derm|skin|clinic|beauty|aesthetic|plastic|dental|hospital|medical/.test(c)) return 'derma'
  if (/food|restaurant|cafe|bakery|kitchen|hansik|yangsik|jungsik/.test(c)) return 'food'
  if (/edu|academy|school|interior|build|design|studio|construction/.test(c)) return 'edu'
  if (/pilates|yoga|fitness|gym|wellness|spa|sports|leisure/.test(c)) return 'wellness'
  return 'default'
}

// 한글 이름에서 첫 글자 (thumb logo 용). 공백/빈 이름 방어.
function firstChar(name: string): string {
  const trimmed = name.trim()
  return trimmed.length > 0 ? Array.from(trimmed)[0] : '·'
}

function formatKoreanDate(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\.\s?$/, '')
}

export default async function OwnerPlacesPage() {
  await requireOwnerUser()
  const places = await listOwnerPlaces()

  const activeCount = places.filter((p) => p.status === 'active').length
  const archivedCount = places.filter((p) => p.status === 'archived').length
  const pendingCount = places.filter((p) => classifyStatus(p.status) === 'pending').length
  const monthlyAmount = activeCount * PLAN_AMOUNT_PER_PLACE

  // AEO snapshot 은 공개 중인 업체만 대상 (archived/pending 은 점수 의미 희박).
  const activePlaceIds = places.filter((p) => p.status === 'active').map((p) => p.id)
  const aeoSnapshots = activePlaceIds.length > 0 ? await loadAeoSnapshotsForPlaces(activePlaceIds) : []
  const aeoByPlaceId = new Map(aeoSnapshots.map((s) => [s.placeId, s]))

  const avgScore = aeoSnapshots.length > 0
    ? Math.round(aeoSnapshots.reduce((sum, s) => sum + s.score, 0) / aeoSnapshots.length)
    : null
  const minScore = aeoSnapshots.length > 0 ? Math.min(...aeoSnapshots.map((s) => s.score)) : null
  const maxScore = aeoSnapshots.length > 0 ? Math.max(...aeoSnapshots.map((s) => s.score)) : null

  return (
    <div className="pl-page">
      <div className="pl-crumb">
        <Link href="/owner">대시보드</Link>
        <span className="sep">›</span>
        <span>내 업체</span>
      </div>

      {/* ========= HERO ========= */}
      <section className="pl-hero">
        <div>
          <p className="pl-hero-kicker">Owner · {places.length}곳 운영 중</p>
          <h1 className="pl-hero-h1">
            내 <span className="serif">업체</span>를<br />
            한곳에서 관리하세요.
          </h1>
          <p className="pl-hero-lede">
            {places.length > 0 ? (
              <>등록된 <b>{places.length}곳</b>의 AI 인용 · 리뷰 · 가독성을 모두 확인하고, 업체별 공개 페이지를 편집할 수 있습니다.</>
            ) : (
              <>아직 등록된 업체가 없습니다. 지금 첫 업체를 추가하면 공개 페이지와 AI 최적화 프로필이 자동 생성돼요.</>
            )}
          </p>
          <div className="pl-hero-ctas">
            <Link href="/owner/places/new" className="pl-btn-accent">+ 새 업체 추가</Link>
            <Link href="/owner/billing" className="pl-btn-ghost-dark">요금제 관리 →</Link>
          </div>
        </div>

        <div className="pl-hero-divide"></div>

        <div className="pl-hero-stats">
          <div className="pl-hero-stat">
            <div className="lbl"><i style={{ background: 'var(--accent-2)' }}></i> 등록된 업체</div>
            <div className="v">{places.length}<span className="u">곳</span></div>
            <div className="sub">
              공개 <b>{activeCount}</b>
              {pendingCount > 0 && <> · 검수 중 <b>{pendingCount}</b></>}
              {archivedCount > 0 && <> · 보관 <b>{archivedCount}</b></>}
            </div>
          </div>
          <div className="pl-hero-stat">
            <div className="lbl"><i style={{ background: '#10a37f' }}></i> 이번 달 청구</div>
            <div className="v">₩{monthlyAmount.toLocaleString('ko-KR')}</div>
            <div className="sub">
              {activeCount > 0 ? (
                <>{activeCount}곳 × <b>₩{PLAN_AMOUNT_PER_PLACE.toLocaleString('ko-KR')}</b> / 월 · 파일럿 30일 무료</>
              ) : (
                <>공개 업체 없음 · 파일럿 30일 무료</>
              )}
            </div>
          </div>
          <div className="pl-hero-stat">
            <div className="lbl"><i style={{ background: 'var(--accent)' }}></i> AI 가독성 평균</div>
            <div className="v">
              {avgScore !== null ? avgScore : '—'}
              {avgScore !== null && <span className="u">/100</span>}
            </div>
            <div className="sub">
              {minScore !== null && maxScore !== null ? (
                <>최저 <b>{minScore}</b> · 최고 <b>{maxScore}</b> · 목표 <b>90+</b></>
              ) : (
                <>공개 업체 등록 시 집계됩니다</>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ========= SECTION LABEL + LIST ========= */}
      {places.length === 0 ? (
        <div className="pl-empty">
          <h2>첫 <span className="it">업체</span>를 등록해 볼까요?</h2>
          <p>업체명을 검색하면 네이버·Google 에서 기본 정보가 자동으로 채워집니다. 30초면 끝 · AI 최적화 프로필은 등록 직후 자동 생성됩니다.</p>
          <Link href="/owner/places/new" className="pl-btn-accent">+ 업체 등록 시작 →</Link>
        </div>
      ) : (
        <>
          <div className="pl-sec">
            <div>
              <div className="k">Businesses · {places.length}곳</div>
              <h2>등록된 <span className="it">업체</span></h2>
            </div>
          </div>

          <div className="biz-list">
            {places.map((p) => {
              const kind = classifyStatus(p.status)
              const badge = statusBadge(kind)
              const aeo = aeoByPlaceId.get(p.id)
              const publicUrl = `/${p.city}/${p.category}/${p.slug}`
              const theme = logoTheme(p.category)
              const updated = formatKoreanDate(p.updated_at)
              const canViewPublic = kind === 'active'

              return (
                <article key={p.id} className={`biz-row${kind === 'archived' ? ' archived' : ''}`}>
                  <div className={`br-logo ${theme}`}>{firstChar(p.name)}</div>

                  <div className="br-main">
                    <div className="br-name">
                      <b>{p.name}</b>
                      <span className="sub">({p.city} · {p.category})</span>
                      <span className={`badge ${badge.cls}`}>{badge.text}</span>
                    </div>
                    <div className="br-meta">
                      <span className="path">{p.slug}</span>
                      {updated && (
                        <>
                          <span className="sep">·</span>
                          <span>최근 수정 {updated}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="br-ai">
                    <div className="top">
                      <span className="lab">AI 가독성</span>
                    </div>
                    {aeo ? (
                      <>
                        <div className="score">{aeo.score}<span className="u">/100</span></div>
                        <div className="bar"><i style={{ width: `${aeo.score}%` }}></i></div>
                        {aeo.topIssues.length === 0 ? (
                          <div className="fix none">개선 필요 없음</div>
                        ) : (
                          <div className="fix">개선 {aeo.topIssues.length}건</div>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="score muted">—</div>
                        <div className="bar"><i style={{ width: '0%' }}></i></div>
                        <div className="fix none">
                          {kind === 'active' ? '집계 대기' : '점수 집계 제외'}
                        </div>
                      </>
                    )}
                  </div>

                  <div className="br-actions">
                    <Link className="a" href={`/owner/places/${p.id}`}>편집</Link>
                    <Link className="a" href={`/owner/places/${p.id}/dashboard`}>대시보드</Link>
                    <span className="sep"></span>
                    {canViewPublic ? (
                      <a
                        className="a"
                        href={publicUrl}
                        target="_blank"
                        rel="noreferrer"
                        title="공개 페이지 열기"
                      >
                        공개 페이지
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                          <path d="M14 3h7v7M10 14L21 3M21 14v5a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h5" />
                        </svg>
                      </a>
                    ) : (
                      <span
                        className="a"
                        aria-disabled="true"
                        title={kind === 'archived' ? '보관된 업체는 공개 페이지가 없습니다' : '검수 통과 후 공개됩니다'}
                        style={{ opacity: 0.5, pointerEvents: 'none', cursor: 'not-allowed' }}
                      >
                        공개 페이지
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                          <path d="M14 3h7v7M10 14L21 3M21 14v5a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h5" />
                        </svg>
                      </span>
                    )}
                    <PlaceRowActions placeId={p.id} placeName={p.name} status={kind} />
                  </div>
                </article>
              )
            })}
          </div>

          <Link href="/owner/places/new" className="biz-add">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v8M8 12h8" />
            </svg>
            새 업체 추가
          </Link>
        </>
      )}

      {/* ========= FOOTER NOTE ========= */}
      <div className="biz-note">
        <div className="t">
          <b>요금 안내 —</b> 업체당 월 ₩{PLAN_AMOUNT_PER_PLACE.toLocaleString('ko-KR')} · 파일럿 30일 무료
          <span className="mono">· 보관 처리한 업체는 결제 대상에서 제외됩니다</span>
        </div>
        <Link className="cta" href="/owner/billing">결제 관리 →</Link>
      </div>
    </div>
  )
}
