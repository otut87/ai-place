'use client'

// Hero 우측 "AI 답변" mock 카드 + GPT/Claude/Gemini 탭 전환 (클라이언트 상태).

import { useState } from 'react'

type PresetKey = 'gpt' | 'claude' | 'gemini'

interface Preset {
  name: string
  model: string
  cls: string
  letter: string
  question: string
}

const PRESETS: Record<PresetKey, Preset> = {
  gpt: {
    name: 'ChatGPT',
    model: 'gpt · 2026.04',
    cls: 'gpt',
    letter: 'C',
    question: '천안 서북구에서 기미 치료 잘하는 피부과 추천해줘',
  },
  claude: {
    name: 'Claude',
    model: 'sonnet · 2026.03',
    cls: 'claude',
    letter: 'C',
    question: '천안에서 야간진료 되는 피부과 알려줘',
  },
  gemini: {
    name: 'Gemini',
    model: '2.5 Pro',
    cls: 'gemini',
    letter: 'G',
    question: '천안 동남구 자동차정비 잘하는 곳',
  },
}

export function HeroChatCard() {
  const [active, setActive] = useState<PresetKey>('gpt')
  const p = PRESETS[active]

  return (
    <div className="chat-stack">
      <div className="chat-card" id="chat-hero">
        <span className="stamp">예시 · 실제 응답은 시점·모델에 따라 달라집니다</span>
        <div className="chat-head">
          <span className={`ai-logo ${p.cls}`}>{p.letter}</span>
          <div className="chat-meta">
            <b>{p.name}</b>
            <span className="dot" />
            <span>{p.model}</span>
          </div>
          <div className="ai-tabs" role="tablist" aria-label="AI 엔진 선택">
            {(Object.keys(PRESETS) as PresetKey[]).map(k => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={active === k}
                className={active === k ? 'active' : ''}
                onClick={() => setActive(k)}
                data-k={k}
              >
                <span className="d" />
                {k === 'gpt' ? 'GPT' : k === 'claude' ? 'Claude' : 'Gemini'}
              </button>
            ))}
          </div>
        </div>

        <div className="msg user">
          <div className="who">소비자</div>
          <div className="bubble">{p.question}</div>
        </div>

        <div className="msg ai">
          <div className="who">답변 (예시)</div>
          <div className="bubble">
            천안 서북구에서 <b>기미 치료</b>로 평가가 좋은 피부과는 다음과 같습니다.
            <ul className="bullet-list">
              <li>
                <span className="rank">01</span>
                <span className="name"><b>클린휴의원</b> — 리프팅·모공·기미 전문</span>
                <span className="tag">★ 4.3 · 29</span>
              </li>
              <li>
                <span className="rank">02</span>
                <span className="name"><b>닥터에버스의원 천안점</b> — 야간진료</span>
                <span className="tag">★ 5.0 · 7</span>
              </li>
              <li>
                <span className="rank">03</span>
                <span className="name"><b>샤인빔클리닉 천안점</b> — 스킨부스터</span>
                <span className="tag">★ 4.0 · 2</span>
              </li>
            </ul>
            <div style={{ marginTop: 10 }}>
              더 자세한 비교는 <span className="cite-chip">aiplace.kr/cheonan/dermatology</span> 에서 확인할 수 있습니다.
            </div>
            <div className="source-line">
              Sources: <a href="/cheonan/dermatology">aiplace.kr</a> · 네이버 플레이스 · Google Places (2026-04)
            </div>
          </div>
        </div>
      </div>

      {/* 배경 데코 카드 */}
      <div className="chat-card" aria-hidden="true">
        <div className="chat-head">
          <span className="ai-logo claude">C</span>
          <div className="chat-meta"><b>Claude</b></div>
        </div>
        <div className="msg user"><div className="bubble">천안 피부과 야간진료</div></div>
      </div>
      <div className="chat-card" aria-hidden="true">
        <div className="chat-head">
          <span className="ai-logo gemini">G</span>
          <div className="chat-meta"><b>Gemini</b></div>
        </div>
        <div className="msg user"><div className="bubble">천안 자동차정비 추천</div></div>
      </div>
    </div>
  )
}
