'use client'

// /owner/citations hero — 검정 카드 + 구간·업체 필터 + 3 stats.
// T-209: 월 프리셋 + 사용자 지정 날짜 범위 추가 (기존 7/30/90 셀렉터와 병존).

import { useRouter, useSearchParams } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import type { OwnerBotSummary, OwnerDailyTrendRow } from '@/lib/owner/bot-stats'
import { monthPresets, toDateInputValue } from '@/lib/owner/period-parser'

interface PlaceOption {
  id: string
  name: string
}

interface Props {
  /** 현재 URL 해석 결과 */
  periodMode: 'days' | 'month' | 'custom'
  periodLabel: string               // '지난 30일' · '2026년 3월' · '2026-03-15 ~ 2026-04-05'
  periodDays: number                // 차트 rangeDays 용
  /** days 모드일 때만 값 존재 */
  days: 7 | 30 | 90 | null
  /** month 모드일 때만 값 존재 (YYYY-MM) */
  monthKey: string | null
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

function formatKstDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${d} ${hh}:${mm}`
}

export function CitationsHero({
  periodMode, periodLabel, periodDays,
  days, monthKey, from, to,
  selectedPlaceId, places,
  botSummary, dailyTrend, lastVisitIso, lastVisitSub,
}: Props) {
  const router = useRouter()
  const params = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [customOpen, setCustomOpen] = useState(periodMode === 'custom')
  const [customFrom, setCustomFrom] = useState(toDateInputValue(from))
  const [customTo, setCustomTo] = useState(toDateInputValue(new Date(to.getTime() - 1)))

  const presets = useMemo(() => monthPresets(new Date()), [])

  function navigate(patch: Record<string, string | null>) {
    const sp = new URLSearchParams(params?.toString() ?? '')
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === '') sp.delete(k)
      else sp.set(k, v)
    }
    startTransition(() => router.replace(`/owner/citations${sp.toString() ? `?${sp}` : ''}`))
  }

  function applyDaysPreset(d: 7 | 30 | 90) {
    navigate({ days: String(d), from: null, to: null })
  }

  function applyMonthPreset(p: typeof presets[number]) {
    const fromStr = toDateInputValue(p.from)
    // to 는 다음 달 1일 00:00 KST — URL 에는 period-parser 호환 날짜만 주면 됨
    const toStr = toDateInputValue(p.to)
    navigate({ from: fromStr, to: toStr, days: null })
  }

  function applyCustom() {
    if (!customFrom || !customTo) return
    // to 는 마지막 일의 **다음 날** 00:00 KST 로 전송 → SQL `<` 기준 포함되도록
    const toDate = new Date(customTo + 'T00:00:00+09:00')
    toDate.setUTCDate(toDate.getUTCDate() + 1)
    const y = toDate.getUTCFullYear()
    const m = String(toDate.getUTCMonth() + 1).padStart(2, '0')
    const d = String(toDate.getUTCDate()).padStart(2, '0')
    const toStr = `${y}-${m}-${d}`
    navigate({ from: customFrom, to: toStr, days: null })
    setCustomOpen(false)
  }

  const recent7 = dailyTrend.slice(-7)
  const searchSeries = recent7.map((r) => r.aiSearch.chatgpt + r.aiSearch.claude + r.aiSearch.perplexity + r.aiSearch.other)
  const trainingSeries = recent7.map((r) => r.aiTraining.chatgpt + r.aiTraining.claude + r.aiTraining.gemini + r.aiTraining.other)
  const sSpark = sparkPath(searchSeries)
  const tSpark = sparkPath(trainingSeries)

  const searchTotal = botSummary.aiSearch.total
  const trainingTotal = botSummary.aiTraining.total
  const grandTotal = searchTotal + trainingTotal
  const placesCount = places.length

  const kickerStr = `${formatKstDate(new Date())} · ${periodLabel}`

  const zeros: string[] = []
  if ((botSummary.aiSearch.byEngine.claude ?? 0) === 0) zeros.push('Claude 실시간')
  if ((botSummary.aiSearch.byEngine.perplexity ?? 0) === 0) zeros.push('Perplexity')
  if ((botSummary.aiTraining.byEngine.claude ?? 0) === 0) zeros.push('ClaudeBot')
  if ((botSummary.aiTraining.byEngine.gemini ?? 0) === 0) zeros.push('Gemini')

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
        <p className="kicker">{kickerStr}</p>
        <h1>
          AI가 당신의 업체를<br />
          총 <span className="serif">{grandTotal}회</span> 접촉했습니다.
        </h1>
        <p className="lede">
          실시간 답변 <b>{searchTotal}회</b>, 학습 크롤링 <b>{trainingTotal}회</b>. 전체 <b>{placesCount}곳</b> 대상.
          {zeros.length > 0 && <> <span className="zero">{zeros.join('·')}는 아직 기록 없음.</span></>}
        </p>

        {/* 1행: days 프리셋 + 업체 필터 */}
        <div className="filt">
          <label>구간</label>
          <div className="pill-group" role="tablist">
            {[7, 30, 90].map((n) => (
              <button
                key={n}
                type="button"
                role="tab"
                aria-selected={periodMode === 'days' && days === n}
                className={periodMode === 'days' && days === n ? 'pill active' : 'pill'}
                onClick={() => applyDaysPreset(n as 7 | 30 | 90)}
              >
                최근 {n}일
              </button>
            ))}
          </div>
          <span className="sep">·</span>
          <label>업체</label>
          <select
            value={selectedPlaceId ?? ''}
            onChange={(e) => navigate({ place: e.target.value || null })}
          >
            <option value="">전체 업체</option>
            {places.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        {/* 2행: 월 프리셋 + 사용자 지정 토글 */}
        <div className="filt">
          <label>월별</label>
          <div className="pill-group">
            {presets.map((p) => (
              <button
                key={p.key}
                type="button"
                aria-pressed={periodMode === 'month' && monthKey === p.yearMonth}
                className={periodMode === 'month' && monthKey === p.yearMonth ? 'pill active' : 'pill'}
                onClick={() => applyMonthPreset(p)}
              >
                {p.label} <small>{p.koreanLabel}</small>
              </button>
            ))}
          </div>
          <span className="sep">·</span>
          <button
            type="button"
            aria-expanded={customOpen}
            className={customOpen ? 'pill active' : 'pill'}
            onClick={() => setCustomOpen((v) => !v)}
          >
            📅 기간 지정
          </button>
        </div>

        {customOpen && (
          <div className="custom-range">
            <label>
              시작 <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
            </label>
            <label>
              종료 <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
            </label>
            <button type="button" className="pill active" onClick={applyCustom}>
              적용
            </button>
            {periodMode === 'custom' && (
              <button type="button" className="pill" onClick={() => applyDaysPreset(30)}>
                초기화
              </button>
            )}
          </div>
        )}
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
            <div className="v" style={{ fontSize: lastVisitIso ? 22 : 26 }}>
              {lastVisitLabel}
            </div>
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

      <style>{`
        .hero .pill-group {
          display: inline-flex;
          gap: 4px;
          flex-wrap: wrap;
        }
        .hero .pill {
          padding: 4px 10px;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,.18);
          background: transparent;
          color: rgba(255,255,255,.82);
          font-size: 12px;
          cursor: pointer;
          transition: background .15s, color .15s, border-color .15s;
        }
        .hero .pill:hover { background: rgba(255,255,255,.08); color: #fff; }
        .hero .pill.active {
          background: #fff;
          color: #191919;
          border-color: #fff;
          font-weight: 600;
        }
        .hero .pill small {
          font-weight: 400;
          font-size: 11px;
          opacity: .8;
          margin-left: 4px;
        }
        .hero .custom-range {
          margin-top: 10px;
          display: inline-flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 10px;
          padding: 10px 12px;
          background: rgba(255,255,255,.06);
          border-radius: 10px;
          font-size: 12px;
        }
        .hero .custom-range label {
          color: rgba(255,255,255,.82);
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .hero .custom-range input[type="date"] {
          padding: 4px 8px;
          border-radius: 6px;
          border: 1px solid rgba(255,255,255,.2);
          background: rgba(255,255,255,.08);
          color: #fff;
          font-size: 12px;
          color-scheme: dark;
        }
      `}</style>
    </section>
  )
}

function SparkSvg({
  d, color, lastX, lastY, hasData,
}: { d: string; color: string; lastX: number; lastY: number; hasData: boolean }) {
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
