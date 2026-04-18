'use server'

// T-057 — 알림 디스패처.
// 이벤트를 받아 이메일/슬랙 페이로드를 생성 후 각 채널로 병렬 전송.
// 어느 한쪽이 실패해도 다른 채널은 계속 시도한다.

import { buildEmailPayload, buildSlackPayload, type NotifyEvent } from '@/lib/notify/events'
import { sendEmail, type EmailSendResult } from '@/lib/notify/email'
import { sendSlack, type SlackSendResult } from '@/lib/notify/slack'

export interface NotifyResult {
  email?: EmailSendResult
  slack?: SlackSendResult
}

export async function dispatchNotify(event: NotifyEvent): Promise<NotifyResult> {
  const emailPayload = buildEmailPayload(event)
  const slackPayload = buildSlackPayload(event)

  const [email, slack] = await Promise.all([
    emailPayload ? sendEmail(emailPayload) : Promise.resolve(undefined),
    slackPayload ? sendSlack(slackPayload) : Promise.resolve(undefined),
  ])

  return { email, slack }
}
