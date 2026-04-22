'use client'

// /owner/citations hero — 검정 카드 + 구간·업체 필터 + 3 stats.
// filter 는 클라이언트 — select 변경 시 router.replace 로 searchParams 갱신.

import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import type { OwnerBotSummary, OwnerDailyTrendRow } from '@/lib/owner/bot-stats'

interface PlaceOption {
  id: string
  name: string
}

interface Props {
  days: 7 | 30 | 90
  selectedPlaceId: string | null
  places: PlaceOption[]
  botSummary: OwnerBotSummary
  dailyTrend: OwnerDailyTrendRow[]
  /** 가장 최근 방문 시각 (null 이면 "아직 없음"). */
  lastVisitIso: string | null
  /** 가장 최근 방문의 엔진/업체 sub 라벨. */
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
  days, selectedPlaceId, places,
  botSummary, dailyTrend, lastVisitIso, lastVisitSub,
}: Props) {
  const router = useRouter()
  const params = useSearchParams()
  const [pending, startTransition] = useTransition()

  function patchQuery(patch: Record<string, string | null>) {
    const sp = new URLSearchParams(params?.toString() ?? '')
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === '') sp.delete(k)
      else sp.set(k, v)
    }
    startTransition(() => router.replace(`/owner/citations${sp.toString() ? `?${sp}` : ''}`))
  }

  // sparkline — 최근 7개 일자
  const recent7 = dailyTrend.slice(-7)
  const searchSeries = recent7.map((r) => r.aiSearch.chatgpt + r.aiSearch.claude + r.aiSearch.perplexity + r.aiSearch.other)
  const trainingSeries = recent7.map((r) => r.aiTraining.chatgpt + r.aiTraining.claude + r.aiTraining.gemini + r.aiTraining.other)
  const sSpark = sparkPath(searchSeries)
  const tSpark = sparkPath(trainingSeries)

  const searchTotal = botSummary.aiSearch.total
  const trainingTotal = botSummary.aiTraining.total
  const grandTotal = searchTotal + trainingTotal
  const placesCount = places.length
  // placesConnected 는 botSummary 만으로 계산 불가 — page 에서 계산해 넘기거나 여기선 생략.

  const kickerStr = `${formatKstDate(new Date())} · 지난 ${days}일`

  const zeros: string[] = []
  if ((botSummary.aiSearch.byEngine.claude ?? 0) === 0) zeros.push('Claude 실시간')
  if ((botSummary.aiSearch.byEngine.perplexity ?? 0) === 0) zeros.push('Perplexity')
  if ((botSummary.aiTraining.byEngine.claude ?? 0) === 0) zeros.push('ClaudeBot')
  if ((botSummary.aiTraining.byEngine.gemini ?? 0) === 0) zeros.push('Gemini')

  // 원본 디자인: "2026. 4. 23." 짧은 형식 + 시각은 sub 에 별도 표기.
  const lastVisitLabel = lastVisitIso
    ? new Date(lastVisitIso).toLocaleDateString('ko-KR', { year: 'numeric', month: 'numeric', day: 'numeric' })
    : '아직 없음'
  const lastVisitTime = lastVisitIso
    ? new Date(lastVisitIso).toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit', second: '2-digit' })
    : null

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
        <div className="filt">
          <label>구간</label>
          <select value={days} onChange={(e) => patchQuery({ days: e.target.value })}>
            <option value="7">최근 7일</option>
            <option value="30">최근 30일</option>
            <option value="90">최근 90일</option>
          </select>
          <span className="sep">·</span>
          <label>업체</label>
          <select
            value={selectedPlaceId ?? ''}
            onChange={(e) => patchQuery({ place: e.target.value || null })}
          >
            <option value="">전체 업체</option>
            {places.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
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
