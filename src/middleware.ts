// AI Place — Middleware
// /admin/* 경로 보호: 미인증 시 /admin/login으로 리다이렉트.
// /admin/login은 공개 (로그인 페이지 자체는 접근 가능).
// 공개 페이지(/, /cheonan/*, /compare/*, /guide/*)에는 영향 없음.
//
// T-081 — AI 봇 방문 감지 시 bot_visits insert (/admin 제외 모든 경로).

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { identifyBot, parseLocalPath } from '@/lib/seo/bot-detection'

async function logBotVisitIfAny(request: NextRequest) {
  const ua = request.headers.get('user-agent')
  const bot = identifyBot(ua)
  if (!bot) return
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return
  try {
    const { city, category, slug } = parseLocalPath(request.nextUrl.pathname)
    await fetch(`${url}/rest/v1/bot_visits`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        bot_id: bot.id,
        user_agent: ua,
        path: request.nextUrl.pathname,
        status: 200,
        referer: request.headers.get('referer') ?? null,
        city,
        category,
        place_slug: slug,
      }),
    })
  } catch {
    // 로그 실패는 방문을 차단하지 않음
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 공개 페이지: 봇 방문만 로깅하고 통과
  if (!pathname.startsWith('/admin') && !pathname.startsWith('/owner')) {
    // best-effort: 응답을 지연시키지 않도록 await 하지 않음
    logBotVisitIfAny(request).catch(() => undefined)
    return NextResponse.next()
  }

  // /admin/login은 공개
  if (pathname === '/admin/login') {
    return NextResponse.next()
  }

  // /owner 는 어드민 이메일 화이트리스트 미적용 — 로그인만 요구
  const isOwnerRoute = pathname.startsWith('/owner')

  // Supabase 세션 갱신 + 인증 확인
  const response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            response.cookies.set(name, value, options)
          })
        },
      },
    },
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    const loginUrl = new URL('/admin/login', request.url)
    if (isOwnerRoute) loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return response
}

export const config = {
  // /admin/owner 보호 + 공개 페이지 봇 로깅. _next/static, 파일 확장자는 제외.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|feed.xml|llms.txt|.*\\..*).*)'],
}
