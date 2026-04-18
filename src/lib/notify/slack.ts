// T-057 — 슬랙 웹훅 전송.
// SLACK_WEBHOOK_URL 이 없으면 콘솔 로깅으로 폴백.

import type { SlackPayload } from '@/lib/notify/events'

export interface SlackSendResult {
  success: boolean
  provider: 'webhook' | 'console'
  error?: string
}

export async function sendSlack(payload: SlackPayload): Promise<SlackSendResult> {
  const url = process.env.SLACK_WEBHOOK_URL
  if (!url) {
    console.info('[notify/slack] (console fallback)', payload)
    return { success: true, provider: 'console' }
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: payload.text }),
    })
    if (!res.ok) {
      return { success: false, provider: 'webhook', error: `Slack ${res.status}` }
    }
    return { success: true, provider: 'webhook' }
  } catch (e) {
    return { success: false, provider: 'webhook', error: (e as Error).message }
  }
}
