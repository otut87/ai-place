// 시드 데이터를 Supabase DB에 삽입하는 스크립트
// 실행: npm run seed:places

// @next/env 를 먼저 로드 — Next 와 동일한 .env 우선순위로 process.env 채움
import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey)

const places = [
  {
    slug: 'yedanpibu',
    name: '예단피부과의원',
    name_en: 'Yedan Dermatology Clinic',
    city: 'cheonan',
    category: 'dermatology',
    description: '천안시 서북구 불당동 위치. 여드름, 피부 레이저, 보톡스 전문 피부과.',
    address: '충남 천안시 서북구 불당26로 62',
    phone: '+82-41-566-7588',
    opening_hours: ['Mo-Fr 09:30-18:30', 'Sa 09:30-14:00'],
    rating: 4.6,
    review_count: 312,
    services: [
      { name: '여드름치료', description: '압출+레이저 병행 치료', priceRange: '5-10만원' },
      { name: '피부레이저', description: '프락셀, IPL, 토닝', priceRange: '10-20만원' },
      { name: '보톡스', description: '이마, 눈가, 사각턱', priceRange: '5-15만원' },
    ],
    faqs: [
      { question: '예단피부과의원 여드름 치료 비용은 얼마인가요?', answer: '여드름 치료는 증상에 따라 5-10만원 정도입니다. 초진 시 상담 후 정확한 비용을 안내드립니다.' },
      { question: '주차 가능한가요?', answer: '네, 건물 내 지하주차장을 이용하실 수 있습니다.' },
    ],
    tags: ['여드름', '레이저', '보톡스', '토닝'],
    latitude: 36.8127,
    longitude: 127.1086,
  },
  {
    slug: 'skinsarang',
    name: '피부사랑피부과',
    name_en: 'Skin Sarang Dermatology',
    city: 'cheonan',
    category: 'dermatology',
    description: '천안시 동남구 위치. 아토피, 건선, 피부질환 전문 피부과 전문의 진료.',
    address: '충남 천안시 동남구 만남로 61',
    phone: '+82-41-578-3377',
    opening_hours: ['Mo-Fr 09:00-18:00', 'Sa 09:00-13:00'],
    rating: 4.3,
    review_count: 187,
    services: [
      { name: '아토피치료', description: '아토피 피부염 전문 치료', priceRange: '3-8만원' },
      { name: '건선치료', description: '광선치료, 약물치료', priceRange: '5-10만원' },
      { name: '피부질환', description: '습진, 두드러기, 대상포진', priceRange: '3-5만원' },
    ],
    faqs: [
      { question: '피부사랑피부과 아토피 치료는 어떻게 하나요?', answer: '환자 상태에 맞는 맞춤 치료를 진행합니다. 광선치료, 보습치료, 약물치료를 병행합니다.' },
      { question: '소아 아토피도 진료하나요?', answer: '네, 소아 아토피 전문 진료를 합니다. 보호자 상담도 함께 진행합니다.' },
    ],
    tags: ['아토피', '건선', '피부질환', '광선치료'],
    latitude: 36.7980,
    longitude: 127.1490,
  },
  {
    slug: 'clean-skin',
    name: '클린스킨피부과',
    name_en: 'Clean Skin Dermatology',
    city: 'cheonan',
    category: 'dermatology',
    description: '천안시 서북구 쌍용동 위치. 여드름 흉터, 모공, 색소 치료 전문.',
    address: '충남 천안시 서북구 쌍용15길 10',
    phone: '+82-41-553-2200',
    opening_hours: ['Mo-Fr 10:00-19:00', 'Sa 10:00-15:00'],
    rating: 4.4,
    review_count: 245,
    services: [
      { name: '여드름흉터', description: '서브시전, 필러, 레이저 병행', priceRange: '10-30만원' },
      { name: '모공치료', description: '모공 축소 레이저', priceRange: '8-15만원' },
      { name: '색소치료', description: '기미, 잡티, 주근깨', priceRange: '5-15만원' },
    ],
    faqs: [
      { question: '클린스킨피부과 여드름 흉터 치료 비용은?', answer: '흉터 범위와 깊이에 따라 10-30만원 선입니다. 정확한 비용은 상담 후 안내됩니다.' },
      { question: '시술 후 일상 생활이 가능한가요?', answer: '대부분의 시술은 당일 일상 생활이 가능합니다. 다만 강한 레이저의 경우 1-2일 붉은기가 있을 수 있습니다.' },
    ],
    tags: ['여드름흉터', '모공', '색소', '기미'],
    latitude: 36.8050,
    longitude: 127.1250,
  },
  {
    slug: 'bom-derma',
    name: '봄피부과의원',
    name_en: 'Bom Dermatology Clinic',
    city: 'cheonan',
    category: 'dermatology',
    description: '천안시 서북구 성정동 위치. 리프팅, 필러, 보톡스 등 안티에이징 전문.',
    address: '충남 천안시 서북구 성정공원3길 12',
    phone: '+82-41-571-8800',
    opening_hours: ['Mo-Fr 10:00-19:00', 'Th 10:00-21:00', 'Sa 10:00-15:00'],
    rating: 4.7,
    review_count: 156,
    services: [
      { name: '리프팅', description: '울쎄라, 실리프팅', priceRange: '30-80만원' },
      { name: '필러', description: '이마, 코, 팔자', priceRange: '15-30만원' },
      { name: '보톡스', description: '이마, 눈가, 사각턱, 승모근', priceRange: '5-15만원' },
    ],
    faqs: [
      { question: '봄피부과의원 리프팅 비용은?', answer: '울쎄라 기준 30-80만원, 실리프팅 기준 20-50만원 정도입니다.' },
      { question: '야간 진료가 가능한가요?', answer: '네, 목요일은 21시까지 야간 진료합니다.' },
    ],
    tags: ['리프팅', '필러', '보톡스', '안티에이징'],
    latitude: 36.8200,
    longitude: 127.1130,
  },
  {
    slug: 'haneul-derm',
    name: '하늘피부과',
    name_en: 'Haneul Dermatology',
    city: 'cheonan',
    category: 'dermatology',
    description: '천안시 서북구 두정동 위치. 탈모, 두피, 모발이식 전문 피부과.',
    address: '충남 천안시 서북구 두정로 112',
    phone: '+82-41-567-3300',
    opening_hours: ['Mo-Fr 09:00-18:00', 'Sa 09:00-13:00'],
    rating: 4.2,
    review_count: 98,
    services: [
      { name: '탈모치료', description: '약물+메조테라피+PRP', priceRange: '10-30만원' },
      { name: '두피관리', description: '두피 스케일링, 관리 프로그램', priceRange: '5-10만원' },
      { name: '모발이식', description: '비절개 모발이식 상담', priceRange: '상담 필요' },
    ],
    faqs: [
      { question: '하늘피부과 탈모 치료는 어떻게 하나요?', answer: '약물치료, 메조테라피, PRP 등을 환자 상태에 맞게 병행합니다.' },
      { question: '탈모 치료 기간은 얼마나 걸리나요?', answer: '최소 3-6개월 꾸준한 치료가 필요합니다. 초기 상담 시 치료 계획을 안내드립니다.' },
    ],
    tags: ['탈모', '두피', '모발이식', 'PRP'],
    latitude: 36.8320,
    longitude: 127.1340,
  },
]

const prompts = [
  { text: '천안 피부과 추천해줘', category: 'dermatology', city: 'cheonan' },
  { text: '천안에서 피부과 잘하는 곳 알려줘', category: 'dermatology', city: 'cheonan' },
  { text: '천안 여드름 치료 잘하는 피부과', category: 'dermatology', city: 'cheonan' },
  { text: '천안 피부 레이저 추천', category: 'dermatology', city: 'cheonan' },
  { text: '천안 보톡스 잘하는 곳', category: 'dermatology', city: 'cheonan' },
  { text: '천안 피부과 가격 비교', category: 'dermatology', city: 'cheonan' },
  { text: '천안 아토피 치료 병원', category: 'dermatology', city: 'cheonan' },
  { text: '천안 탈모 치료 피부과', category: 'dermatology', city: 'cheonan' },
  { text: '천안 여드름 흉터 치료 비용', category: 'dermatology', city: 'cheonan' },
  { text: '천안 리프팅 잘하는 피부과', category: 'dermatology', city: 'cheonan' },
  { text: '충남 천안 피부과 순위', category: 'dermatology', city: 'cheonan' },
  { text: '천안 불당동 피부과 추천', category: 'dermatology', city: 'cheonan' },
  { text: '천안 기미 치료 잘하는 곳', category: 'dermatology', city: 'cheonan' },
  { text: '천안 모공 축소 레이저 추천', category: 'dermatology', city: 'cheonan' },
  { text: '천안 피부과 야간 진료', category: 'dermatology', city: 'cheonan' },
]

async function seed() {
  console.log('Seeding places...')
  const { data: placesData, error: placesError } = await supabase
    .from('places')
    .upsert(places, { onConflict: 'city,category,slug' })
    .select('id, name')

  if (placesError) {
    console.error('Places error:', placesError)
    process.exit(1)
  }
  console.log(`✓ ${placesData?.length ?? 0} places seeded`)

  console.log('Seeding test prompts...')
  const { data: promptsData, error: promptsError } = await supabase
    .from('test_prompts')
    .upsert(prompts, { onConflict: 'text' })
    .select('id, text')

  if (promptsError) {
    // If upsert fails due to no unique constraint on text, do insert
    const { data: insertData, error: insertError } = await supabase
      .from('test_prompts')
      .insert(prompts)
      .select('id, text')

    if (insertError) {
      console.error('Prompts error:', insertError)
      process.exit(1)
    }
    console.log(`✓ ${insertData?.length ?? 0} prompts seeded`)
  } else {
    console.log(`✓ ${promptsData?.length ?? 0} prompts seeded`)
  }

  console.log('Done!')
}

seed()
