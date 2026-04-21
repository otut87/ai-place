'use client'

// SCHEMA DEMO 섹션의 탭 — "업체 정보 카드 / 자주 묻는 질문 / 비교표".
// 기존엔 <span> 정적 탭이라 클릭해도 전환 안 됐음 → 클라이언트 state 로 전환.

import { useState } from 'react'

type TabKey = 'profile' | 'faq' | 'compare'

interface Props {
  updatedMonth: string // "2026-04"
}

const TABS: { key: TabKey; label: string }[] = [
  { key: 'profile', label: '업체 정보 카드' },
  { key: 'faq', label: '자주 묻는 질문' },
  { key: 'compare', label: '비교표' },
]

export function SchemaDemoTabs({ updatedMonth }: Props) {
  const [active, setActive] = useState<TabKey>('profile')

  return (
    <div className="code-card" role="img" aria-label="AI 가 읽는 업체 정보 예시">
      <div className="tabbar">
        {TABS.map(t => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={active === t.key}
            className={`tf${active === t.key ? ' active' : ''}`}
            onClick={() => setActive(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {active === 'profile' && (
        <pre>
          <span className="c">{'// AI가 보는 업체 정보 — 예시'}</span>
          {'\n\n'}
          <span className="k">업체명</span>       <span className="s">클린휴의원</span>{'\n'}
          <span className="k">업종</span>         <span className="s">피부과 (의료)</span>{'\n'}
          <span className="k">주소</span>         <span className="s">충남 천안시 동남구 청수4로 16 5층</span>{'\n'}
          <span className="k">평점</span>         <span className="n">4.3</span> <span className="c">(리뷰 29건)</span>{'\n'}
          <span className="k">대표 시술</span>    <span className="s">기미 치료 · 여드름 치료 · 리프팅</span>{'\n'}
          <span className="k">영업 시간</span>    <span className="s">월~금 10:00–19:00</span>{'\n'}
          <span className="k">전화</span>         <span className="s">041-***-****</span>{'\n'}
          <span className="k">네이버</span>       <span className="s">naver.me/…</span>{'\n'}
          <span className="k">카카오맵</span>     <span className="s">map.kakao.com/…</span>{'\n'}
          <span className="k">구글</span>         <span className="s">google.com/maps/…</span>{'\n\n'}
          <span className="c">{'// 출처: 네이버 플레이스 · 기준 '}{updatedMonth}</span>
        </pre>
      )}

      {active === 'faq' && (
        <pre>
          <span className="c">{'// 자주 묻는 질문 — 업종별 20~30개 자동 초안'}</span>
          {'\n\n'}
          <span className="k">Q1</span> <span className="s">기미 치료는 몇 회 받아야 효과가 있나요?</span>{'\n'}
          <span className="k">A1</span> <span className="c">평균 3~5회 시술 후 톤이 균일해지며, 레이저 종류와 피부 타입에 따라 다릅니다.</span>{'\n\n'}
          <span className="k">Q2</span> <span className="s">여드름 치료 건강보험 적용 되나요?</span>{'\n'}
          <span className="k">A2</span> <span className="c">염증성 여드름은 보험 적용, 흉터·색소침착 치료는 비급여입니다.</span>{'\n\n'}
          <span className="k">Q3</span> <span className="s">야간진료 운영 시간은?</span>{'\n'}
          <span className="k">A3</span> <span className="c">매주 화·목 19:00~21:00 (예약 필수). 공휴일 미운영.</span>{'\n\n'}
          <span className="c">{'// AI 가 "답변 문장"으로 바로 인용 가능한 구조'}</span>
        </pre>
      )}

      {active === 'compare' && (
        <pre>
          <span className="c">{'// 비교표 — 같은 업종 내 3개 업체 예시'}</span>
          {'\n\n'}
          <span className="k">항목</span>         <span className="s">클린휴의원</span>   <span className="s">닥터에버스</span>   <span className="s">샤인빔</span>{'\n'}
          <span className="k">특화</span>         <span className="n">기미·리프팅</span>   <span className="n">야간진료</span>     <span className="n">스킨부스터</span>{'\n'}
          <span className="k">평점</span>         <span className="n">4.3</span>          <span className="n">5.0</span>          <span className="n">4.0</span>{'\n'}
          <span className="k">리뷰수</span>       <span className="n">29</span>           <span className="n">7</span>            <span className="n">2</span>{'\n'}
          <span className="k">영업시간</span>     <span className="s">10–19</span>        <span className="s">10–21</span>        <span className="s">11–20</span>{'\n'}
          <span className="k">주차</span>         <span className="s">건물 주차</span>    <span className="s">발렛</span>         <span className="s">길거리</span>{'\n\n'}
          <span className="c">{'// AI 가 "근거 있는 추천"을 위해 비교 근거로 사용'}</span>
        </pre>
      )}
    </div>
  )
}
