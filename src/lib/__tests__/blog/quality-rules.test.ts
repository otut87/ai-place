// T-193 — 16 결정론 룰 테스트.
// 각 룰의 boundary 와 대표 fail/pass 케이스를 커버.
import { describe, it, expect } from 'vitest'
import {
  checkTitleLength,
  checkMetaDescLength,
  checkH1Singleton,
  checkImageAltRequired,
  checkSlugAsciiSafe,
  checkDirectAnswerLength,
  checkFAQCount,
  checkTargetQueryUsage,
  checkSevenBlockStructure,
  checkCityMention,
  checkLocalBusinessMention,
  checkInternalLinks,
  checkPlaceNameAllowlist,
  checkBannedPhrases,
  checkNeutralTone,
  checkExternalLinks,
  checkKeywordDensity,
  checkSentenceEnding,
  checkHeadingDepth,
  checkTableOrList,
  checkAICliches,
} from '@/lib/blog/quality-rules'

// ---- SEO ----
describe('checkTitleLength', () => {
  it('30자 미만 FAIL', () => {
    const r = checkTitleLength('짧은 제목')
    expect(r.pass).toBe(false)
    expect(r.severity).toBe('fail')
  })
  it('30~60자 PASS', () => {
    const r = checkTitleLength('a'.repeat(40))
    expect(r.pass).toBe(true)
  })
  it('60자 초과 FAIL', () => {
    const r = checkTitleLength('a'.repeat(61))
    expect(r.pass).toBe(false)
  })
})

describe('checkMetaDescLength', () => {
  it('50자 미만 FAIL', () => {
    expect(checkMetaDescLength('짧은 요약').pass).toBe(false)
  })
  it('50~160자 PASS (Direct Answer 와 겸용)', () => {
    expect(checkMetaDescLength('가'.repeat(60)).pass).toBe(true)
    expect(checkMetaDescLength('가'.repeat(145)).pass).toBe(true)
  })
  it('161자 이상 FAIL', () => {
    expect(checkMetaDescLength('가'.repeat(161)).pass).toBe(false)
  })
})

describe('checkH1Singleton', () => {
  it('H1 0개 PASS', () => {
    expect(checkH1Singleton('## 섹션\n본문').pass).toBe(true)
  })
  it('H1 1개 FAIL', () => {
    expect(checkH1Singleton('# 제목\n본문').pass).toBe(false)
  })
  it('코드블록 안의 # 은 무시', () => {
    expect(checkH1Singleton('```\n# 주석\n```\n## 실제 섹션').pass).toBe(true)
  })
})

describe('checkImageAltRequired', () => {
  it('alt 정상 PASS', () => {
    expect(checkImageAltRequired('![건강한 피부](a.png)').pass).toBe(true)
  })
  it('alt 비어있으면 FAIL', () => {
    expect(checkImageAltRequired('![](a.png)').pass).toBe(false)
  })
  it('이미지 없으면 PASS', () => {
    expect(checkImageAltRequired('본문뿐').pass).toBe(true)
  })
})

describe('checkSlugAsciiSafe', () => {
  it('영문+하이픈 PASS', () => {
    expect(checkSlugAsciiSafe('cheonan-dermatology-2026').pass).toBe(true)
  })
  it('한글 slug FAIL', () => {
    expect(checkSlugAsciiSafe('천안-피부과').pass).toBe(false)
  })
  it('공백 FAIL', () => {
    expect(checkSlugAsciiSafe('foo bar').pass).toBe(false)
  })
})

// ---- AEO ----
describe('checkDirectAnswerLength', () => {
  it('40~80자 PASS', () => {
    expect(checkDirectAnswerLength('가'.repeat(60)).pass).toBe(true)
  })
  it('39자 FAIL', () => {
    expect(checkDirectAnswerLength('가'.repeat(39)).pass).toBe(false)
  })
  it('81자 FAIL', () => {
    expect(checkDirectAnswerLength('가'.repeat(81)).pass).toBe(false)
  })
})

describe('checkFAQCount', () => {
  it('3~5 PASS', () => {
    expect(checkFAQCount([1, 2, 3]).pass).toBe(true)
    expect(checkFAQCount([1, 2, 3, 4, 5]).pass).toBe(true)
  })
  it('2 FAIL', () => {
    expect(checkFAQCount([1, 2]).pass).toBe(false)
  })
  it('6 FAIL', () => {
    expect(checkFAQCount([1, 2, 3, 4, 5, 6]).pass).toBe(false)
  })
})

describe('checkTargetQueryUsage', () => {
  it('3회 이상 PASS', () => {
    const content = '천안 피부과 천안 피부과 천안 피부과'
    expect(checkTargetQueryUsage(content, '천안 피부과').pass).toBe(true)
  })
  it('1~2회 WARN', () => {
    const r = checkTargetQueryUsage('천안 피부과 한번 언급', '천안 피부과')
    expect(r.pass).toBe(false)
    expect(r.severity).toBe('warn')
  })
  it('0회 FAIL', () => {
    const r = checkTargetQueryUsage('아무 내용 없음', '천안 피부과')
    expect(r.severity).toBe('fail')
  })
  it('null 키워드는 WARN', () => {
    expect(checkTargetQueryUsage('x', null).severity).toBe('warn')
  })
})

describe('checkSevenBlockStructure', () => {
  const FULL = `
## 결론
천안 피부과 중 여드름 치료 전문 3곳을 추천합니다. 평균 평점 4.7 이상, 전문의 2인 이상 기준 선정 결과입니다.

## 분석 방법
천안 피부과 23곳의 공개 리뷰 412건, HIRA 개설 자료, Google Places 평점을 집계했습니다. 분석 기간은 2026년 1월~4월이며 가중치는 리뷰:평점:전문의 = 3:2:1 입니다. /about/methodology 참고.

## 업체별 상세
### A 피부과
A 피부과는 천안 동남구 소재 전문의 2인 운영 의원입니다. 리뷰 수 120건, 평점 4.8점 기록이며 상담 시간 평균 15분이 확보됩니다. 주차장 완비, 진료시간 오전 9시부터 오후 7시. 모공·흉터 관리를 함께 다룹니다.

### B 피부과
B 피부과는 천안 서북구 소재 전문의 1인 운영 의원입니다. 리뷰 95건, 평점 4.7점 기록. 레이저 장비 다수 보유, 야간 진료 가능. 주말 오후 진료 운영.

## 비교표
| 업체 | 전문의 | 리뷰 | 평점 |
|---|---|---|---|
| A 피부과 | 2인 | 120건 | 4.8 |
| B 피부과 | 1인 | 95건 | 4.7 |

## 체크리스트
- 전문의 자격 확인 (HIRA 검색)
- 상담 시간 15분 이상 보장 여부
- 부작용 상담 프로세스 공개 여부
- 가격표 사전 제시 여부
- 응급 연락망 안내 여부
- 재진 주기 설명 여부

## 위험 신호
- 전문의 자격이 불확실하거나 원장만 있는 경우
- 1회 방문 후 고가의 장기 결제 패키지 유도
- 부작용 설명 생략하거나 서면 동의서 없이 시술
- 가격 비공개 또는 상담 시점 구두 안내

## 자주 묻는 질문
**Q. 여드름 치료는 몇 회 받나요?** A. 일반적으로 8~12주 주기로 4~6회 내외입니다.
**Q. 건강보험 적용되나요?** A. 일부 적용됩니다. 상담 필요.
**Q. 흉터 치료도 가능한가요?** A. 천안 피부과 대부분 가능합니다.

**면책**: 본 글은 공개 데이터 기반 자체 조사이며 의료 진단이 아닙니다. 치료 효과는 개인에 따라 다를 수 있습니다.
`
  it('7블록 완비 PASS', () => {
    expect(checkSevenBlockStructure(FULL, 'medical').pass).toBe(true)
  })
  it('결론 블록 누락 FAIL', () => {
    expect(checkSevenBlockStructure(FULL.replace(/## 결론[\s\S]*?## 분석/, '## 분석'), 'medical').pass).toBe(false)
  })
})

// ---- GEO ----
describe('checkCityMention', () => {
  it('5회 이상 PASS', () => {
    const body = '천안 천안 천안 천안 천안'
    expect(checkCityMention(body, '천안').pass).toBe(true)
  })
  it('5회 미만 WARN', () => {
    const r = checkCityMention('천안 한 번', '천안')
    expect(r.pass).toBe(false)
    expect(r.severity).toBe('warn')
  })
})

describe('checkLocalBusinessMention', () => {
  it('각 업체 2회 이상 PASS', () => {
    const body = 'A 피부과 A 피부과 B 피부과 B 피부과'
    expect(checkLocalBusinessMention(body, ['A 피부과', 'B 피부과']).pass).toBe(true)
  })
  it('하나 부족 WARN', () => {
    const body = 'A 피부과 A 피부과 B 피부과'
    const r = checkLocalBusinessMention(body, ['A 피부과', 'B 피부과'])
    expect(r.pass).toBe(false)
    expect(r.severity).toBe('warn')
  })
  it('업체 없음 PASS', () => {
    expect(checkLocalBusinessMention('x', []).pass).toBe(true)
  })
})

describe('checkInternalLinks', () => {
  it('3개 이상 내부 링크 PASS', () => {
    const body = '[a](/x) [b](/y) [c](/z)'
    expect(checkInternalLinks(body).pass).toBe(true)
  })
  it('외부 링크는 카운트 안함', () => {
    const body = '[a](https://example.com) [b](https://other.com)'
    expect(checkInternalLinks(body).pass).toBe(false)
  })
  it('aiplace.kr 절대경로는 내부', () => {
    const body = '[a](https://aiplace.kr/a) [b](https://aiplace.kr/b) [c](https://aiplace.kr/c)'
    expect(checkInternalLinks(body).pass).toBe(true)
  })
})

// ---- 환각·위생 ----
describe('checkPlaceNameAllowlist', () => {
  it('allowlist 내 업체만 등장 PASS', () => {
    const r = checkPlaceNameAllowlist('A 피부과 방문 후기', ['A 피부과'], ['경쟁 피부과'])
    expect(r.pass).toBe(true)
  })
  it('forbidden 등장 FAIL', () => {
    const r = checkPlaceNameAllowlist('경쟁 피부과 방문 후기', ['A 피부과'], ['경쟁 피부과'])
    expect(r.pass).toBe(false)
    expect(r.severity).toBe('fail')
  })
  it('후보 미지정시 검사 생략', () => {
    expect(checkPlaceNameAllowlist('아무 내용', [], []).pass).toBe(true)
  })
})

describe('checkBannedPhrases', () => {
  it('일반 카테고리에서 최고의 FAIL', () => {
    expect(checkBannedPhrases('최고의 병원').pass).toBe(false)
  })
  it('medical 카테고리에서 완치 FAIL', () => {
    expect(checkBannedPhrases('완치를 보장합니다', 'medical').pass).toBe(false)
  })
  it('깨끗한 본문 PASS', () => {
    expect(checkBannedPhrases('객관적 사실만 서술합니다', 'medical').pass).toBe(true)
  })
})

describe('checkNeutralTone', () => {
  it('과장 표현 FAIL', () => {
    expect(checkNeutralTone('단연 1위').pass).toBe(false)
  })
  it('비방 표현 FAIL', () => {
    expect(checkNeutralTone('최악이니 거르세요').pass).toBe(false)
  })
  it('중립 서술 PASS', () => {
    expect(checkNeutralTone('평점 4.5점, 리뷰 120건 기준으로 서술합니다').pass).toBe(true)
  })
})

describe('checkExternalLinks', () => {
  it('외부 링크 존재 FAIL', () => {
    expect(checkExternalLinks('[a](https://google.com)').pass).toBe(false)
  })
  it('내부 링크만 PASS', () => {
    expect(checkExternalLinks('[a](/x) [b](https://aiplace.kr/y)').pass).toBe(true)
  })
})

// ---- 품질 ----
describe('checkKeywordDensity', () => {
  it('5~12회 PASS', () => {
    const body = '키워드 '.repeat(7)
    expect(checkKeywordDensity(body, '키워드').pass).toBe(true)
  })
  it('4회 WARN', () => {
    const body = '키워드 '.repeat(4)
    const r = checkKeywordDensity(body, '키워드')
    expect(r.pass).toBe(false)
    expect(r.severity).toBe('warn')
  })
  it('13회 WARN', () => {
    const body = '키워드 '.repeat(13)
    expect(checkKeywordDensity(body, '키워드').pass).toBe(false)
  })
  it('키워드 null 은 패스', () => {
    expect(checkKeywordDensity('x', null).pass).toBe(true)
  })
})

describe('checkSentenceEnding', () => {
  it('다양한 어미 PASS', () => {
    expect(checkSentenceEnding('깨끗합니다. 조용해요. 이어지는 내용.').pass).toBe(true)
  })
  it('같은 어미 3연속 WARN', () => {
    const body = '같습니다. 같습니다. 같습니다. 같습니다.'
    expect(checkSentenceEnding(body).pass).toBe(false)
  })
})

describe('checkHeadingDepth', () => {
  it('H2 4+ H3 2+ PASS', () => {
    const body = '## a\n## b\n## c\n## d\n### x\n### y'
    expect(checkHeadingDepth(body).pass).toBe(true)
  })
  it('부족 WARN', () => {
    expect(checkHeadingDepth('## a\n## b').pass).toBe(false)
  })
})

describe('checkTableOrList', () => {
  it('table PASS', () => {
    expect(checkTableOrList('| a | b |\n|---|---|\n| 1 | 2 |').pass).toBe(true)
  })
  it('list PASS', () => {
    expect(checkTableOrList('- 항목 1\n- 항목 2').pass).toBe(true)
  })
  it('없으면 WARN', () => {
    expect(checkTableOrList('그냥 본문').pass).toBe(false)
  })
})

describe('checkAICliches', () => {
  it('3개 이하 PASS', () => {
    expect(checkAICliches('다양한 내용입니다').pass).toBe(true)
  })
  it('4개 이상 WARN', () => {
    // AI_CLICHES = 다양한, 효과적인, 중요한, 혁신적인, 최적의 — 4개 사용
    expect(checkAICliches('다양한 효과적인 중요한 혁신적인').pass).toBe(false)
  })
})
