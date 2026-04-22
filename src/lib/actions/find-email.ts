'use server'

// 휴대폰 번호로 가입된 이메일(아이디) 조회.
// customers.phone 은 가입 시 형식이 다양(010-1234-5678 / 01012345678 / +82-10-1234-5678 등)하게
// 들어갈 수 있어서, 서버에서 normalizePhone 하여 몇 가지 포맷으로 순차 비교.
//
// 보안 노트:
// - 이메일은 마스킹 처리 (user 의 앞 2글자 + *** + 도메인)
// - 존재 여부로 전화번호 enumeration 되는 건 불가피 — 향후 rate-limit 도입 (TODO)

import { getAdminClient } from '@/lib/supabase/admin-client'

export type FindEmailResult =
  | { success: true; maskedEmail: string }
  | { success: false; error: string }

function normalizeDigits(raw: string): string {
  return raw.replace(/\D/g, '')
}

function buildCandidateFormats(raw: string): string[] {
  const digits = normalizeDigits(raw)
  const formats = new Set<string>()
  formats.add(raw.trim())
  formats.add(digits)

  // 010-1234-5678 스타일 (11자리 한국 휴대폰)
  if (digits.length === 11 && digits.startsWith('010')) {
    formats.add(`${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`)
  }
  // 010-123-4567 스타일 (10자리)
  if (digits.length === 10 && digits.startsWith('01')) {
    formats.add(`${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`)
  }
  return [...formats].filter(Boolean)
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!local || !domain) return email
  if (local.length <= 2) return `${local[0] ?? ''}*@${domain}`
  return `${local.slice(0, 2)}${'*'.repeat(Math.max(1, local.length - 2))}@${domain}`
}

export async function findEmailByPhoneAction(rawPhone: string): Promise<FindEmailResult> {
  const digits = normalizeDigits(rawPhone)
  if (digits.length < 9 || digits.length > 15) {
    return { success: false, error: '올바른 휴대폰 번호를 입력해 주세요.' }
  }

  const admin = getAdminClient()
  if (!admin) {
    return { success: false, error: '서비스 일시 장애입니다. 잠시 후 다시 시도해 주세요.' }
  }

  const candidates = buildCandidateFormats(rawPhone)

  for (const phone of candidates) {
    const { data, error } = await admin
      .from('customers')
      .select('email')
      .eq('phone', phone)
      .limit(1)
      .maybeSingle()

    if (error && error.code !== 'PGRST116') {
      return { success: false, error: '조회 중 오류가 발생했습니다.' }
    }
    if (data?.email) {
      return { success: true, maskedEmail: maskEmail(data.email) }
    }
  }

  return { success: false, error: '해당 번호로 가입된 이메일이 없습니다.' }
}
