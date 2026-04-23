'use client'

// /owner/citations hero — 검정 카드 + 월 필터 통합 바 + 3 stats.
// T-211: 월 피커(연도 라벨 + 이전/다음 + 3개월 pill + 캘린더 드롭다운) + 업체 필터를
// 하나의 컴포넌트로 통합. 캘린더는 body portal (hero overflow:hidden 탈출).

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import type { OwnerBotSummary, OwnerDailyTrendRow } from '@/lib/owner/bot-stats'
import { monthBounds, toDateInputValue } from '@/lib/owner/period-parser'

interface PlaceOption {
  id: string
  name: string
}

interface Props {
  periodMode: 'days' | 'month' | 'custom'
  periodLabel: string
  periodDays: number
  days: 7 | 30 | 90 | null
  monthKey: string | null        // 'YYYY-MM' when mode === 'month'
  from: Date
  to: Date
  selectedPlaceId: string | null
  places: PlaceOption[]
  botSummary: OwnerBotSummary
  dailyTrend: OwnerDailyTrendRow[]
  lastVisitIso: string | null
  lastVisitSub: string | null
}

const SPARK_W = 84
const SPARK_H = 40

function sparkPath(values: number[]): { d: string; lastX: number; lastY: number } {
  const n = values.length
  if (n === 0) return { d: '', lastX: SPARK_W, lastY: SPARK_H - 4 }
  const max = Math.max(1, ...values)
  const stepX = n > 1 ? SPARK_W / (n - 1) : SPARK_W
  const pts = values.map((v, i) => ({
    x: i * stepX,
    y: SPARK_H - 4 - ((v / max) * (SPARK_H - 8)),
  }))
  const d = `M${pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L')}`
  const last = pts[pts.length - 1]
  return { d, lastX: last.x, lastY: last.y }
}

// KST 기준 현재 연/월
function kstNowYM(now: Date = new Date()): { y: number; m: number } {
  const kst = new Date(now.getTime() + 9 * 3_600_000)
  return { y: kst.getUTCFullYear(), m: kst.getUTCMonth() + 1 }
}

function kickerText(mode: string, monthKey: string | null, totalCount: number, from: Date, to: Date): string {
  const kst = kstNowYM()
  if (mode === 'month' && monthKey) {
    const [y, m] = monthKey.split('-').map(Number)
    const isCurrent = y === kst.y && m === kst.m
    const lastDay = isCurrent
      ? String(new Date().getDate())
      : String(new Date(y, m, 0).getDate())
    return `${y}. ${m}월 · ${m}/1 – ${m}/${lastDay} · 누적 ${totalCount}회`
  }
  if (mode === 'custom') {
    const f = toDateInputValue(from).replace(/^\d{4}-/, '').replace('-', '/')
    const tInclusive = new Date(to.getTime() - 1)
    const t = toDateInputValue(tInclusive).replace(/^\d{4}-/, '').replace('-', '/')
    return `${f} – ${t} · 누적 ${totalCount}회`
  }
  // days
  return `${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'numeric', day: 'numeric' }).replace(/\.\s*$/, '')} · 누적 ${totalCount}회`
}

export function CitationsHero({
  periodMode, monthKey, from, to, periodDays,
  selectedPlaceId, places,
  botSummary, dailyTrend, lastVisitIso, lastVisitSub,
}: Props) {
  const router = useRouter()
  const params = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [panelOpen, setPanelOpen] = useState(false)
  const [panelYear, setPanelYear] = useState(() => {
    if (monthKey) return parseInt(monthKey.split('-')[0], 10)
    return kstNowYM().y
  })
  const [panelCoords, setPanelCoords] = useState<{ top: number; left: number } | null>(null)
  const dropBtnRef = useRef<HTMLButtonElement | null>(null)
  const filtRef = useRef<HTMLDivElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  // document.body 접근 가능 여부 — portal 은 클라이언트에서만 렌더.
  const canPortal = typeof document !== 'undefined'

  const nowYM = useMemo(() => kstNowYM(new Date()), [])

  // 현재 활성 월 (month 모드 or 오늘 기준)
  const activeYM = useMemo(() => {
    if (periodMode === 'month' && monthKey) {
      const [y, m] = monthKey.split('-').map(Number)
      return { y, m }
    }
    return nowYM
  }, [periodMode, monthKey, nowYM])

  // 3개월 pill — active 기준 -2, -1, 0 offset
  const pillMonths = useMemo(() => {
    const out: Array<{ y: number; m: number; key: string; isActive: boolean; isCurrent: boolean }> = []
    for (let off = -2; off <= 0; off++) {
      let mm = activeYM.m + off, yy = activeYM.y
      if (mm < 1) { mm += 12; yy -= 1 }
      if (mm > 12) { mm -= 12; yy += 1 }
      const key = `${yy}-${String(mm).padStart(2, '0')}`
      out.push({
        y: yy, m: mm, key,
        isActive: yy === activeYM.y && mm === activeYM.m,
        isCurrent: yy === nowYM.y && mm === nowYM.m,
      })
    }
    return out
  }, [activeYM, nowYM])

  function navigateToMonth(y: number, m: number) {
    // future month block
    if (y > nowYM.y || (y === nowYM.y && m > nowYM.m)) return
    const { from: fD, to: tD } = monthBounds(y, m - 1)
    const fromStr = toDateInputValue(fD)
    const toStr = toDateInputValue(tD)
    const sp = new URLSearchParams(params?.toString() ?? '')
    sp.set('from', fromStr); sp.set('to', toStr); sp.delete('days')
    startTransition(() => router.replace(`/owner/citations${sp.toString() ? `?${sp}` : ''}`))
    setPanelOpen(false)
  }

  function navigateDir(dir: 1 | -1) {
    let mm = activeYM.m + dir, yy = activeYM.y
    if (mm < 1) { mm += 12; yy -= 1 }
    if (mm > 12) { mm -= 12; yy += 1 }
    navigateToMonth(yy, mm)
  }

  function togglePanel() {
    if (panelOpen) {
      setPanelOpen(false)
      return
    }
    const btn = dropBtnRef.current
    if (btn) {
      const r = btn.getBoundingClientRect()
      setPanelCoords({
        top: r.bottom + 8,
        left: Math.max(12, Math.min(r.left, window.innerWidth - 320)),
      })
    }
    setPanelYear(activeYM.y)
    setPanelOpen(true)
  }

  // outside click close
  useEffect(() => {
    if (!panelOpen) return
    function onClick(e: MouseEvent) {
      if (filtRef.current?.contains(e.target as Node)) return
      if (panelRef.current?.contains(e.target as Node)) return
      setPanelOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [panelOpen])

  function onPlaceChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const v = e.target.value
    const sp = new URLSearchParams(params?.toString() ?? '')
    if (v) sp.set('place', v); else sp.delete('place')
    startTransition(() => router.replace(`/owner/citations${sp.toString() ? `?${sp}` : ''}`))
  }

  // Hero stats 계산
  const recent7 = dailyTrend.slice(-7)
  const searchSeries = recent7.map((r) => r.aiSearch.chatgpt + r.aiSearch.claude + r.aiSearch.perplexity + r.aiSearch.other)
  const trainingSeries = recent7.map((r) => r.aiTraining.chatgpt + r.aiTraining.claude + r.aiTraining.gemini + r.aiTraining.other)
  const sSpark = sparkPath(searchSeries)
  const tSpark = sparkPath(trainingSeries)

  const searchTotal = botSummary.aiSearch.total
  const trainingTotal = botSummary.aiTraining.total
  const grandTotal = searchTotal + trainingTotal
  const placesCount = places.length

  const kicker = kickerText(periodMode, monthKey, grandTotal, from, to)

  const zeros: string[] = []
  if ((botSummary.aiSearch.byEngine.claude ?? 0) === 0) zeros.push('Claude 실시간')
  if ((botSummary.aiSearch.byEngine.perplexity ?? 0) === 0) zeros.push('Perplexity')
  if ((botSummary.aiTraining.byEngine.gemini ?? 0) === 0) zeros.push('Gemini 크롤링')

  const lastVisitLabel = lastVisitIso
    ? new Date(lastVisitIso).toLocaleDateString('ko-KR', { year: 'numeric', month: 'numeric', day: 'numeric' })
    : '아직 없음'
  const lastVisitTime = lastVisitIso
    ? new Date(lastVisitIso).toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit', second: '2-digit' })
    : null

  void periodDays

  return (
    <section className="hero" data-pending={pending ? 'true' : undefined}>
      <div>
        <p className="kicker">{kicker}</p>
        <h1>
          AI가 당신의 업체를<br />
          총 <span className="serif">{grandTotal}회</span> 접촉했습니다.
        </h1>
        <p className="lede">
          실시간 답변 <b>{searchTotal}회</b>, 학습 크롤링 <b>{trainingTotal}회</b>. 전체 <b>{placesCount}곳</b> 대상.
          {zeros.length > 0 && <> <span className="zero">{zeros.join('·')}는 아직 기록 없음.</span></>}
        </p>

        <div className="filt" ref={filtRef} id="monthFilt">
          <span className="mf-year-lbl">{activeYM.y}</span>

          <button className="mf-nav" aria-label="이전 월" onClick={() => navigateDir(-1)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M15 18l-6-6 6-6" /></svg>
          </button>

          {pillMonths.map((p) => (
            <button
              key={p.key}
              className={p.isActive ? 'mf-pill active' : 'mf-pill'}
              onClick={() => navigateToMonth(p.y, p.m)}
            >
              {p.m}월
              {p.isCurrent && !p.isActive && <span className="mf-cur">·오늘</span>}
            </button>
          ))}

          <button
            ref={dropBtnRef}
            className="mf-drop"
            aria-label="월 선택 열기"
            aria-haspopup="true"
            onClick={togglePanel}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </button>

          <button
            className="mf-nav"
            aria-label="다음 월"
            onClick={() => navigateDir(1)}
            disabled={activeYM.y === nowYM.y && activeYM.m >= nowYM.m}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M9 18l6-6-6-6" /></svg>
          </button>

          <span className="sep sep-biz" />
          <div className="mf-biz">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
              <path d="M3 21h18M6 21V7l6-4 6 4v14" />
            </svg>
            <select
              aria-label="업체 선택"
              value={selectedPlaceId ?? ''}
              onChange={onPlaceChange}
            >
              <option value="">전체 업체 ({places.length})</option>
              {places.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="divide" />

      <div className="stats">
        <div className="stat">
          <div>
            <div className="lbl"><i style={{ background: '#10a37f' }} /> 직접 답변 (실시간)</div>
            <div className="v">{searchTotal}<span className="u">회</span></div>
            <div className="sub">
              ChatGPT <b>{botSummary.aiSearch.byEngine.chatgpt ?? 0}</b>
              {' · '}Claude <b>{botSummary.aiSearch.byEngine.claude ?? 0}</b>
              {' · '}Perplexity <b>{botSummary.aiSearch.byEngine.perplexity ?? 0}</b>
            </div>
          </div>
          <SparkSvg d={sSpark.d} color="#10a37f" lastX={sSpark.lastX} lastY={sSpark.lastY} hasData={searchTotal > 0} />
        </div>
        <div className="stat">
          <div>
            <div className="lbl"><i style={{ background: 'var(--warn)' }} /> 간접 노출 (학습 크롤링)</div>
            <div className="v">{trainingTotal}<span className="u">회</span></div>
            <div className="sub">
              GPTBot <b>{botSummary.aiTraining.byEngine.chatgpt ?? 0}</b>
              {' · '}ClaudeBot <b>{botSummary.aiTraining.byEngine.claude ?? 0}</b>
              {' · '}Gemini <b>{botSummary.aiTraining.byEngine.gemini ?? 0}</b>
            </div>
          </div>
          <SparkSvg d={tSpark.d} color="#b45309" lastX={tSpark.lastX} lastY={tSpark.lastY} hasData={trainingTotal > 0} />
        </div>
        <div className="stat">
          <div>
            <div className="lbl"><i style={{ background: 'var(--accent)' }} /> 마지막 발생</div>
            <div className="v" style={{ fontSize: lastVisitIso ? 22 : 26 }}>{lastVisitLabel}</div>
            <div className="sub">
              {lastVisitTime ? <>{lastVisitTime} · {lastVisitSub ?? '—'}</> : 'AI 봇 방문 대기 중'}
            </div>
          </div>
          <svg width={44} height={44} viewBox="0 0 44 44" style={{ flex: '0 0 44px' }}>
            <circle cx={22} cy={22} r={18} fill="none" stroke="rgba(255,255,255,.14)" strokeWidth={3.5} />
            <path d="M22 10 V22 L30 26" stroke="#ff7a50" strokeWidth={2.2} strokeLinecap="round" fill="none" />
          </svg>
        </div>
      </div>

      {/* 캘린더 드롭다운 — body portal (클라이언트에서만) */}
      {canPortal && panelOpen && panelCoords && createPortal(
        <CalendarPanel
          refProp={panelRef}
          year={panelYear}
          setYear={setPanelYear}
          activeYM={activeYM}
          nowYM={nowYM}
          top={panelCoords.top}
          left={panelCoords.left}
          onPick={navigateToMonth}
          onJumpToday={() => {
            navigateToMonth(nowYM.y, nowYM.m)
          }}
        />,
        document.body,
      )}
    </section>
  )
}

interface CalendarPanelProps {
  refProp: React.RefObject<HTMLDivElement | null>
  year: number
  setYear: (y: number) => void
  activeYM: { y: number; m: number }
  nowYM: { y: number; m: number }
  top: number
  left: number
  onPick: (y: number, m: number) => void
  onJumpToday: () => void
}

function CalendarPanel({ refProp, year, setYear, activeYM, nowYM, top, left, onPick, onJumpToday }: CalendarPanelProps) {
  return (
    <div
      ref={refProp}
      className="mf-panel"
      style={{ position: 'fixed', top, left }}
    >
      <div className="mf-panel-head">
        <button className="mf-py" aria-label="이전 년" onClick={() => setYear(year - 1)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <b>{year}</b>
        <button
          className="mf-py"
          aria-label="다음 년"
          onClick={() => setYear(year + 1)}
          disabled={year >= nowYM.y}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M9 18l6-6-6-6" /></svg>
        </button>
      </div>
      <div className="mf-grid">
        {Array.from({ length: 12 }, (_, i) => {
          const m = i + 1
          const isFuture = year > nowYM.y || (year === nowYM.y && m > nowYM.m)
          const isActive = year === activeYM.y && m === activeYM.m
          const isCurrent = year === nowYM.y && m === nowYM.m
          const cls = [
            'mf-m',
            isActive ? 'active' : '',
            isCurrent && !isActive ? 'current' : '',
            isFuture ? 'future' : '',
          ].filter(Boolean).join(' ')
          return (
            <button
              key={m}
              className={cls}
              disabled={isFuture}
              onClick={() => !isFuture && onPick(year, m)}
            >
              {m}월
            </button>
          )
        })}
      </div>
      <div className="mf-panel-foot">
        <button className="mf-today" onClick={onJumpToday}>이번 달로</button>
      </div>
    </div>
  )
}

function SparkSvg({ d, color, lastX, lastY, hasData }: { d: string; color: string; lastX: number; lastY: number; hasData: boolean }) {
  if (!hasData || !d) {
    return (
      <svg className="spark" viewBox={`0 0 ${SPARK_W} ${SPARK_H}`} fill="none" preserveAspectRatio="none">
        <line x1={0} y1={SPARK_H - 4} x2={SPARK_W} y2={SPARK_H - 4} stroke={color} strokeOpacity={0.35} strokeWidth={1.4} strokeDasharray="3 4" />
      </svg>
    )
  }
  return (
    <svg className="spark" viewBox={`0 0 ${SPARK_W} ${SPARK_H}`} fill="none" preserveAspectRatio="none">
      <path d={d} stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lastX} cy={lastY} r={3} fill={color} />
    </svg>
  )
}
