// T-125 — /about/methodology 조사 방법론 페이지 데이터 소스.
// 철학: "자체 조사"라는 표현은 이 페이지 하나로 수렴.
// GEO §4.1 E-E-A-T + AEO FAQ.

import type { FAQ } from '@/lib/types'

export interface MethodologySource {
  label: string
  purpose: string
  url?: string
}

export interface MethodologyCadence {
  period: string
  scope: string
}

export interface EeatAxis {
  axis: 'Experience' | 'Expertise' | 'Authoritativeness' | 'Trustworthiness'
  korean: string
  practice: string
}

export function getMethodologySources(): MethodologySource[] {
  return [
    {
      label: '공식 기관 자료 (HIRA, 건강보험심사평가원)',
      purpose: '의료 기관 개설 여부·전문의 자격 검증. 허위 전문의 노출 차단.',
      url: 'https://www.hira.or.kr',
    },
    {
      label: '지도 플랫폼 (Google Places, Kakao Local)',
      purpose: '주소·전화번호·영업시간 확인. 공식 가이드라인 준수하며 API만 사용.',
    },
    {
      label: '공개 리뷰 (Google, Kakao, Naver)',
      purpose: '리뷰 건수·평균 평점·긍정/부정 주제 추출. 인용 시 원본 링크 병기.',
    },
    {
      label: 'AI 검색 엔진 인용 테스트 (ChatGPT, Claude, Gemini)',
      purpose: '업체·키워드 조합 쿼리로 인용 여부 측정. 주간 스냅샷 기록.',
    },
  ]
}

export function getMethodologyUpdateCadence(): MethodologyCadence[] {
  return [
    {
      period: '주 1회',
      scope: 'AI 인용 스냅샷(ChatGPT/Claude/Gemini), 신규 리뷰 크롤, robots.txt',
    },
    {
      period: '월 1회',
      scope: '공개 리뷰 평점·주제 재집계, JSON-LD 검증 리포트, 업체 영업 상태 확인',
    },
    {
      period: '분기 1회',
      scope: '공식 기관 데이터 대조, 전문의 자격·개설 현황 전수 재확인, 카테고리 데이터 사전 업데이트',
    },
  ]
}

export function getEeatCriteria(): EeatAxis[] {
  return [
    {
      axis: 'Experience',
      korean: '경험',
      practice: '실제 업체 방문 또는 공개 인터뷰 기반 내용만 게재. 가상 후기·생성형 콘텐츠 차단.',
    },
    {
      axis: 'Expertise',
      korean: '전문성',
      practice: '의료·법률·세무 등 규제 업종은 자격 보유자 감수 전까지 비교·추천 콘텐츠를 노출하지 않음.',
    },
    {
      axis: 'Authoritativeness',
      korean: '권위',
      practice: 'Person + ProfilePage + Article 스키마로 저자 식별. 저자 단일 소스(lib/authors.ts).',
    },
    {
      axis: 'Trustworthiness',
      korean: '신뢰',
      practice: '수치는 모두 출처·날짜·표본 크기 명시. 추측·과장 표현 금지. dateModified 자동 동기화.',
    },
  ]
}

export function getMethodologyFaqs(): FAQ[] {
  return [
    {
      question: '업체 정보는 어디서 수집하나요?',
      answer: '공식 기관 자료(예: 건강보험심사평가원), 지도 플랫폼 공식 API(Google Places, Kakao Local), 공개 리뷰 플랫폼(Google/Kakao/Naver)을 조합합니다. 스크래핑 금지 정책에 따라 각 플랫폼의 이용약관을 준수합니다.',
    },
    {
      question: '리뷰 수·평점은 어떤 기준으로 집계하나요?',
      answer: '공개된 리뷰만 대상으로 하며, 최근 12개월 이내 리뷰에 가중치를 둡니다. 긍정·부정 주제는 원문 기반으로 추출하고, 대표 리뷰는 50~200자 범위에서 원문을 그대로 인용합니다.',
    },
    {
      question: '갱신 주기는 어떻게 되나요?',
      answer: 'AI 인용 스냅샷은 주 1회, 리뷰·평점 재집계는 월 1회, 공식 기관 데이터 대조는 분기 1회 수행합니다. 각 페이지 하단의 "마지막 업데이트" 날짜가 실제 갱신 시점입니다.',
    },
    {
      question: 'AI 검색 인용 여부는 어떻게 측정하나요?',
      answer: '주요 LLM(ChatGPT, Claude, Gemini)에 동일한 쿼리 세트("천안 피부과 추천" 등)를 주 1회 실행하고, 업체 이름이 인용되는지를 기록합니다. 결과는 업체별 인용 지표로 관리합니다.',
    },
    {
      question: '의료·법률·세무 같은 규제 업종은 어떻게 다루나요?',
      answer: '규제 업종은 비교·추천 콘텐츠 노출 전에 해당 자격 보유자 감수를 거칩니다. 감수 전 단계에서는 업체 기본 정보와 FAQ만 공개하고, 순위·추천은 표시하지 않습니다.',
    },
    {
      question: '잘못된 정보가 있으면 어떻게 수정되나요?',
      answer: '업체 또는 이용자의 정정 요청이 접수되면 48시간 이내 확인하고, 공식 기관·공개 리뷰를 통해 재검증 후 반영합니다. 수정 이력은 dateModified 필드로 기록됩니다.',
    },
  ]
}
