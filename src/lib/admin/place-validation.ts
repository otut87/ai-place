export interface HoursEntry {
  day: string
  open: string
  close: string
  closed: boolean
}

export interface ServiceEntry {
  name: string
  description: string
  priceRange: string
}

export interface FaqEntry {
  question: string
  answer: string
}

export interface PlaceDraft {
  name: string
  city: string
  category: string
  slug: string
  description: string
  address: string
  phone: string
  hours: HoursEntry[]
  services: ServiceEntry[]
  faqs: FaqEntry[]
  tags: string[]
  sameAs: string[]
}

export interface DraftValidation {
  errors: Record<string, string>
  warnings: string[]
  completeness: number
}

const SLUG_RE = /^[a-z0-9-]+$/
const PHONE_RE = /^[\d\s\-+()]+$/
const DESCRIPTION_MIN = 30

export function validatePlaceDraft(input: PlaceDraft): DraftValidation {
  const errors: Record<string, string> = {}
  const warnings: string[] = []

  if (!input.name.trim()) errors.name = '업체명을 입력하세요.'

  if (!input.city.trim()) errors.city = '도시를 선택하세요.'
  if (!input.category.trim()) errors.category = '업종(카테고리)을 선택하세요.'

  const slug = input.slug.trim()
  if (!slug) errors.slug = '슬러그가 필요합니다.'
  else if (!SLUG_RE.test(slug) || slug.length > 100) errors.slug = '슬러그는 소문자·숫자·하이픈만 허용됩니다.'

  const description = input.description.trim()
  if (!description) errors.description = '소개 문구가 필요합니다.'
  else if (description.length < DESCRIPTION_MIN) {
    errors.description = `소개 문구는 최소 ${DESCRIPTION_MIN}자 이상 입력하세요.`
  }

  if (!input.address.trim()) errors.address = '주소가 필요합니다.'

  const phone = input.phone.trim()
  if (!phone) errors.phone = '전화번호가 필요합니다.'
  else if (!PHONE_RE.test(phone)) errors.phone = '전화번호 형식이 올바르지 않습니다.'

  const filledFaqs = input.faqs.filter((f) => f.question.trim() && f.answer.trim())
  if (filledFaqs.length === 0) errors.faqs = 'FAQ를 최소 1개 이상 작성하세요.'

  // Warnings — 권장 항목
  const openDays = input.hours.filter((h) => !h.closed && h.open && h.close)
  if (openDays.length === 0) warnings.push('영업시간이 비어 있습니다.')

  const filledServices = input.services.filter((s) => s.name.trim())
  if (filledServices.length === 0) warnings.push('서비스 항목이 없습니다 (LLM 콘텐츠 품질에 영향).')

  if (input.tags.length === 0) warnings.push('태그를 입력하면 검색 노출에 유리합니다.')

  if (input.sameAs.length === 0) warnings.push('sameAs (외부 URL)가 없습니다 — 네이버/카카오/구글 지도 링크를 추가하세요.')

  // Completeness — 10 항목 × 10 점
  const signals: boolean[] = [
    Boolean(input.name.trim()),
    Boolean(input.city.trim()),
    Boolean(input.category.trim()),
    Boolean(slug) && SLUG_RE.test(slug),
    description.length >= DESCRIPTION_MIN,
    Boolean(input.address.trim()),
    Boolean(phone) && PHONE_RE.test(phone),
    openDays.length > 0,
    filledFaqs.length > 0,
    filledServices.length > 0 || input.tags.length > 0 || input.sameAs.length > 0,
  ]

  const completeness = Math.round((signals.filter(Boolean).length / signals.length) * 100)

  return { errors, warnings, completeness }
}
