// T-057 — 이메일 전송 어댑터.
// 기본은 Resend (RESEND_API_KEY + RESEND_FROM). 키가 없으면 콘솔 로깅으로 폴백 —
// 로컬/프리뷰 환경에서도 동작하고, 배포 환경에서는 실제로 발송.

import type { EmailPayload } from '@/lib/notify/events'

const RESEND_ENDPOINT = 'https://api.resend.com/emails'

export interface EmailSendResult {
  success: boolean
  provider: 'resend' | 'console'
  error?: string
  id?: string
}

export async function sendEmail(payload: EmailPayload): Promise<EmailSendResult> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM

  if (!apiKey || !from) {
    console.info('[notify/email] (console fallback)', payload)
    return { success: true, provider: 'console' }
  }

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: payload.to,
        subject: payload.subject,
        text: payload.body,
      }),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return { success: false, provider: 'resend', error: `Resend ${res.status}: ${text}` }
    }
    const json = (await res.json().catch(() => ({}))) as { id?: string }
    return { success: true, provider: 'resend', id: json.id }
  } catch (e) {
    return { success: false, provider: 'resend', error: (e as Error).message }
  }
}
