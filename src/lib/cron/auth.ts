// T-254 — Vercel Cron Bearer 인증 헬퍼.
//
// 이전 패턴 `if (secret && auth !== Bearer ${secret})` 는 secret 이 falsy 이면
// 인증 자체를 건너뛰는 fail-open 우회였다. preview deploy / 환경변수 누락 시
// /api/cron/billing-charge 등이 비인증 공개 엔드포인트가 되는 문제.
//
// 이 헬퍼는 fail-closed:
//   - VERCEL_CRON_SECRET 미설정 → 503 (서비스 미준비)
//   - 헤더 불일치 → 401
//   - 일치 → null 반환 (호출부 그대로 진행)

import { NextResponse } from 'next/server'

export function verifyCronAuth(req: Request): NextResponse | null {
  const secret = process.env.VERCEL_CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'cron_secret_unset' }, { status: 503 })
  }
  const auth = req.headers.get('authorization') ?? ''
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  return null
}
