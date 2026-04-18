// AI Place — Middleware
// /admin/* 경로 보호: 미인증 시 /admin/login으로 리다이렉트.
// /admin/login은 공개 (로그인 페이지 자체는 접근 가능).
// 공개 페이지(/, /cheonan/*, /compare/*, /guide/*)에는 영향 없음.

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

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
  // /admin 전체(로그인 제외) + /owner 전체 보호
  matcher: ['/admin/:path((?!login).*)', '/owner/:path*'],
}
