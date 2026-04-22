// T-195 — 썸네일 생성 실측 스크립트 (1~2장 수동 검증용).
//
// 실행: npx tsx scripts/test-thumbnail-generation.ts
//
// 동작:
//  1) buildThumbnailPrompt 로 샘플 2개 프롬프트 생성 (파이프라인 실제 입력 모사)
//  2) OpenAI gpt-image-2 low 에 fetch 직접 호출 ($0.006 × 2 = ~16원 지출)
//  3) ./tmp/thumbnails/ 에 PNG 저장 + 프롬프트를 .txt 로 함께 저장
//  4) 사용자가 파일 열어서 품질·의미 반영·텍스트 미포함 검증

import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'
// .env.local 우선, .env fallback — Next.js 관행과 동일.
dotenv.config({ path: path.resolve('.env.local') })
dotenv.config({ path: path.resolve('.env') })
import { buildThumbnailPrompt } from '@/lib/ai/image-prompt-builder'

const OUTPUT_DIR = path.resolve('./tmp/thumbnails')
const OPENAI_URL = 'https://api.openai.com/v1/images/generations'

interface Sample {
  slug: string
  summary: string
  highlights: string[]
  categoryName: string
  cityName: string
  sector: string
  angle: 'review-deepdive' | 'price-transparency' | 'procedure-guide' | 'first-visit' | 'comparison-context' | 'seasonal'
  titleForAlt: string   // 이미지 자체에는 들어가지 않음 — 파일명/alt 용
}

// 두 샘플 — 서로 다른 sector + angle 로 다양성 확인.
const SAMPLES: Sample[] = [
  {
    slug: 'sample-medical-review',
    summary: '천안에서 여드름 치료로 만족도가 높은 피부과 3곳을 추천합니다. 평균 평점 4.7 이상 전문의 2인 기준 선정.',
    highlights: ['리뷰 412건 자체 분석', '평균 평점 4.7', '전문의 2인 이상'],
    categoryName: '피부과',
    cityName: '천안',
    sector: 'medical',
    angle: 'review-deepdive',
    titleForAlt: '천안 피부과 추천 3곳 리뷰 412건 분석',
  },
  {
    slug: 'sample-food-price',
    summary: '천안 도담동 가성비 맛집 5곳의 가격대와 메뉴 투명 공개 — 평균 1인 12,000원 내외 기준 정리.',
    highlights: ['5곳 가격대 비교', '1인 평균 12,000원', '메뉴판 공개 여부'],
    categoryName: '한식당',
    cityName: '천안',
    sector: 'food',
    angle: 'price-transparency',
    titleForAlt: '천안 도담동 가성비 한식당 5곳 가격 공개',
  },
]

async function generateOne(sample: Sample, apiKey: string): Promise<void> {
  const prompt = buildThumbnailPrompt({
    summary: sample.summary,
    highlights: sample.highlights,
    categoryName: sample.categoryName,
    cityName: sample.cityName,
    sector: sample.sector,
    angle: sample.angle,
  })

  const promptPath = path.join(OUTPUT_DIR, `${sample.slug}.prompt.txt`)
  fs.writeFileSync(promptPath, prompt, 'utf8')
  console.log(`\n[${sample.slug}] ─────────────────────────────`)
  console.log(`  sector=${sample.sector}, angle=${sample.angle}`)
  console.log(`  prompt 저장: ${promptPath}`)
  console.log(`  OpenAI 호출 중... (약 10~20s)`)

  const t0 = Date.now()
  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-image-2',
      prompt,
      size: '1024x1024',
      quality: 'low',
      n: 1,
    }),
  })
  const latency = ((Date.now() - t0) / 1000).toFixed(1)

  if (!res.ok) {
    const text = await res.text()
    console.error(`  ❌ ${res.status} ${latency}s`)
    console.error(`  응답: ${text.slice(0, 400)}`)
    return
  }

  const data = (await res.json()) as {
    data?: Array<{ b64_json?: string; url?: string }>
  }
  const first = data.data?.[0]
  if (!first) {
    console.error(`  ❌ 응답 비어있음`)
    return
  }

  let bytes: Buffer
  if (first.b64_json) {
    bytes = Buffer.from(first.b64_json, 'base64')
  } else if (first.url) {
    const imgRes = await fetch(first.url)
    bytes = Buffer.from(await imgRes.arrayBuffer())
  } else {
    console.error(`  ❌ b64_json 과 url 둘 다 없음`)
    return
  }

  const pngPath = path.join(OUTPUT_DIR, `${sample.slug}.png`)
  fs.writeFileSync(pngPath, bytes)
  const sizeKb = (bytes.length / 1024).toFixed(0)
  console.log(`  ✅ ${latency}s · ${sizeKb} KB · ${pngPath}`)
}

async function main() {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    console.error('OPENAI_API_KEY 미설정 — .env.local 확인')
    process.exit(1)
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  console.log(`출력 디렉토리: ${OUTPUT_DIR}`)
  console.log(`샘플 ${SAMPLES.length}장 — 예상 비용 ~${SAMPLES.length * 8}원 (gpt-image-2 low $0.006/장)`)

  for (const s of SAMPLES) {
    try {
      await generateOne(s, apiKey)
    } catch (err) {
      console.error(`[${s.slug}] 예외: ${err instanceof Error ? err.message : err}`)
    }
  }

  console.log(`\n완료 — tmp/thumbnails/ 안의 .png 파일 열어 확인하세요.`)
  console.log(`  검증 포인트:`)
  console.log(`  1) 이미지 안에 텍스트가 없는지 (제목·숫자·글자 전무)`)
  console.log(`  2) summary 의 의미가 일러스트에 반영됐는지`)
  console.log(`  3) sector 팔레트 (medical=mint/navy, food=terracotta/olive) 준수`)
  console.log(`  4) angle 구도 반영 (review-deepdive=balanced, price=chart-ish)`)
}

main().catch(err => {
  console.error('fatal:', err)
  process.exit(1)
})
