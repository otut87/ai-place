// IndexNow 제출 스크립트 (T-010i 갱신)
// Bing, Naver, Yandex 에 페이지 URL 을 즉시 알림
// ChatGPT 가 Bing 인덱스 기반이므로 GEO 핵심 인프라 (§5.4)
//
// 실행: npm run indexnow
//
// 구 /k/* /compare/* /guide/* URL 은 T-010g 에서 삭제됨 — 여기서도 제외.
// 블로그 글 URL 은 DB 에서 동적으로 조회 (마이그레이션된 12개).

import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())

import { getAllPlaces } from '../src/lib/data.supabase'
import { getAllActiveBlogPosts } from '../src/lib/blog/data.supabase'

const API_KEY = 'afbc07a4d2aa07d4839997d4dbd3923c'
const HOST = 'aiplace.kr'
const BASE_URL = `https://${HOST}`

async function buildUrls(): Promise<string[]> {
  const urls: string[] = [
    BASE_URL,                  // 홈
    `${BASE_URL}/about`,       // 소개
    `${BASE_URL}/blog`,        // 블로그 홈
    `${BASE_URL}/sitemap.xml`, // 사이트맵
  ]

  // 활성 업체 카테고리 리스팅 (city+category 조합)
  const places = await getAllPlaces()
  const cityCategorySet = new Set<string>()
  for (const p of places) {
    cityCategorySet.add(`${p.city}/${p.category}`)
    urls.push(`${BASE_URL}/${p.city}/${p.category}/${p.slug}`) // 업체 상세
  }
  for (const cc of cityCategorySet) {
    urls.push(`${BASE_URL}/${cc}`) // 카테고리 리스팅
  }

  // 블로그 글 (마이그레이션된 12개)
  const blogPosts = await getAllActiveBlogPosts()
  for (const p of blogPosts) {
    urls.push(`${BASE_URL}/blog/${p.city}/${p.sector}/${p.slug}`)
  }

  // 중복 제거
  return Array.from(new Set(urls))
}

async function submitIndexNow() {
  const dryRun = process.argv.includes('--dry-run')
  const urls = await buildUrls()

  const body = {
    host: HOST,
    key: API_KEY,
    keyLocation: `${BASE_URL}/${API_KEY}.txt`,
    urlList: urls,
  }

  console.log(`IndexNow ${dryRun ? '[DRY-RUN]' : '제출'}: ${urls.length}개 URL`)
  console.log('---')
  urls.forEach(url => console.log(`  ${url}`))
  console.log('---')

  if (dryRun) {
    console.log('(dry-run — 외부 호출 없음)')
    return
  }

  const res = await fetch('https://api.indexnow.org/IndexNow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  })

  console.log(`응답: ${res.status} ${res.statusText}`)

  if (res.ok || res.status === 200 || res.status === 202) {
    console.log('✅ IndexNow 제출 성공 — Bing/Naver/Yandex 에 URL 이 알림되었습니다.')
  } else {
    const text = await res.text()
    console.error(`❌ IndexNow 제출 실패: ${text}`)
    process.exit(1)
  }
}

submitIndexNow().catch(err => {
  console.error('치명적 오류:', err)
  process.exit(1)
})
