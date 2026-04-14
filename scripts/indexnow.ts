// IndexNow 제출 스크립트
// Bing, Naver, Yandex에 페이지 URL을 즉시 알림
// ChatGPT가 Bing 인덱스 기반이므로 GEO 핵심 인프라 (§5.4)
//
// 실행: npx tsx scripts/indexnow.ts

const API_KEY = 'afbc07a4d2aa07d4839997d4dbd3923c'
const HOST = 'aiplace.kr'
const BASE_URL = `https://${HOST}`

// 제출할 URL 목록
const urls = [
  // 메인
  BASE_URL,
  // 리스팅
  `${BASE_URL}/cheonan/dermatology`,
  // 프로필
  `${BASE_URL}/cheonan/dermatology/soo-derm`,
  `${BASE_URL}/cheonan/dermatology/dr-evers`,
  `${BASE_URL}/cheonan/dermatology/cleanhue`,
  `${BASE_URL}/cheonan/dermatology/shinebeam`,
  `${BASE_URL}/cheonan/dermatology/alive-skin`,
  // 비교
  `${BASE_URL}/compare/cheonan/dermatology/acne-treatment`,
  `${BASE_URL}/compare/cheonan/dermatology/laser-treatment`,
  `${BASE_URL}/compare/cheonan/dermatology/anti-aging`,
  // 가이드
  `${BASE_URL}/guide/cheonan/dermatology`,
  // 키워드 랜딩
  `${BASE_URL}/cheonan/dermatology/k/acne`,
  `${BASE_URL}/cheonan/dermatology/k/botox`,
  `${BASE_URL}/cheonan/dermatology/k/lifting`,
  `${BASE_URL}/cheonan/dermatology/k/blemish`,
  `${BASE_URL}/cheonan/dermatology/k/night-clinic`,
  `${BASE_URL}/cheonan/dermatology/k/recommend`,
  `${BASE_URL}/cheonan/dermatology/k/hair-loss`,
  `${BASE_URL}/cheonan/dermatology/k/scar`,
  // SEO
  `${BASE_URL}/sitemap.xml`,
]

async function submitIndexNow() {
  const body = {
    host: HOST,
    key: API_KEY,
    keyLocation: `${BASE_URL}/${API_KEY}.txt`,
    urlList: urls,
  }

  console.log(`IndexNow 제출: ${urls.length}개 URL`)
  console.log('---')
  urls.forEach(url => console.log(`  ${url}`))
  console.log('---')

  const res = await fetch('https://api.indexnow.org/IndexNow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  })

  console.log(`응답: ${res.status} ${res.statusText}`)

  if (res.ok || res.status === 200 || res.status === 202) {
    console.log('IndexNow 제출 성공! Bing/Naver/Yandex에 URL이 알림되었습니다.')
  } else {
    const text = await res.text()
    console.error(`IndexNow 제출 실패: ${text}`)
  }
}

submitIndexNow().catch(console.error)
