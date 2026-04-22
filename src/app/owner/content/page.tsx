// /owner/content — 내 업체가 언급된 콘텐츠 (Remix 디자인 content.html 구현).
//
// 소스:
//   - place_mentions + blog_posts (제목/요약/본문/태그/post_type/썸네일)
//   - bot_visits 집계 (path 당 AI 봇 방문 수 → "최근 AI 인용")
// 탭: all / blog / compare / guide / keyword
//   ↑ blog_posts.post_type 기준. 실제 URL 은 전부 /blog/…
// 허수 금지: 0 데이터는 그대로 0 + off 스타일.

import type { Metadata } from 'next'
import Link from 'next/link'
import { requireOwnerUser } from '@/lib/owner/auth'
import { listOwnerPlaces } from '@/lib/actions/owner-places'
import { loadOwnerContent, type ContentTabKey } from '@/lib/owner/content-mentions'
import { getOwnerByPathSummary } from '@/lib/owner/bot-stats'
import { composePageTitle } from '@/lib/seo/compose-title'
import { EmptyState } from '../_components/empty-state'
import { ContentHero } from './_components/content-hero'
import { ContentTabs } from './_components/content-tabs'
import { ContentCard } from './_components/content-card'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: composePageTitle('콘텐츠 관리'),
  description: '내 업체가 언급된 aiplace.kr 내부 콘텐츠를 확인하세요.',
  robots: { index: false, follow: false },
}

type FilterKey = ContentTabKey | 'all'

interface Params {
  searchParams: Promise<{ type?: string }>
}

function parseType(raw: string | undefined): FilterKey {
  if (raw === 'detail' || raw === 'compare' || raw === 'guide' || raw === 'keyword') return raw
  return 'all'
}

export default async function OwnerContentPage({ searchParams }: Params) {
  const user = await requireOwnerUser()
  const { type } = await searchParams
  const active = parseType(type)

  const ownerPlaces = await listOwnerPlaces()
  const placeIds = ownerPlaces.map((p) => p.id)
  const placesById = new Map(ownerPlaces.map((p) => [p.id, p]))

  if (placeIds.length === 0) {
    return (
      <div className="content-page">
        <div className="crumb">
          <Link href="/owner">← 대시보드</Link>
          <span>/</span>
          <span>콘텐츠</span>
        </div>
        <EmptyState
          eyebrow="· · · 아직 등록된 업체가 없어요 · · ·"
          title={<>업체를 <em>등록</em>하면 콘텐츠 언급이 시작됩니다</>}
          description="업체당 월 5편의 블로그(비교·가이드·키워드 포함)가 자동 발행되며, 본문 언급 시마다 목록에 추가됩니다."
          action={{ href: '/owner/places/new', label: '+ 업체 등록', variant: 'accent' }}
        />
      </div>
    )
  }

  const [{ items: allItems, counts }, byPath] = await Promise.all([
    loadOwnerContent(placeIds),
    getOwnerByPathSummary(placeIds, 90),
  ])

  // 전체 = 탭 합산 + general(미분류). loadOwnerContent 가 allItems 에 general 도 담고
  // counts 에는 탭 4종만 누적하므로 totalCount 는 allItems.length.
  const totalCount = allItems.length

  // 탭 필터 — 'all' 은 모두(general 포함), 특정 탭은 contentType 일치.
  const filtered = active === 'all'
    ? allItems
    : allItems.filter((i) => i.contentType === active)

  const latestSortKey = allItems[0]?.sortKey ?? null

  // path -> citation count 맵 (90일 윈도우)
  const citationByPath = new Map<string, number>()
  for (const row of byPath) citationByPath.set(row.path, row.total)

  return (
    <div className="content-page">
      <div className="crumb">
        <Link href="/owner">← 대시보드</Link>
        <span>/</span>
        <span>콘텐츠</span>
      </div>

      <ContentHero counts={counts} totalCount={totalCount} latestSortKey={latestSortKey} />

      <ContentTabs active={active} totalCount={totalCount} counts={counts} />

      {filtered.length === 0 ? (
        <div className="c-empty">
          <h4>
            {active === 'all'
              ? '아직 내 업체가 언급된 콘텐츠가 없습니다'
              : `아직 내 업체가 언급된 ${labelFor(active)}가 없습니다`}
          </h4>
          <p>
            블로그 자동 발행은 매월 업체당 5편 · 언급은 주 단위로 이 목록에 반영됩니다.
          </p>
        </div>
      ) : (
        <div className="c-list">
          {filtered.map((i) => (
            <ContentCard
              key={i.path}
              item={i}
              placesById={placesById}
              citationCount={citationByPath.get(i.path) ?? 0}
            />
          ))}
        </div>
      )}

      <div className="c-helper">
        <h4><span className="dt" /> 편집·발행 상태 관리는 운영팀이 담당합니다</h4>
        <p>
          모든 콘텐츠는 <b>/blog/…</b> URL 하위의 블로그글이며 <b>post_type</b> 으로 세부 유형이 구분됩니다 —
          <b>업체 정보</b>(내 업체 1곳 심층) · <b>비교</b>(업체 vs 업체) · <b>가이드</b>(선택 기준) · <b>키워드 페이지</b>(지역+업종 랜딩).
          내 업체 상세 페이지(<code>aiplace.kr/[city]/[category]/[slug]</code>) 관리는 <b>/owner/places</b> 에서 하세요.
          사실 정정·삭제·수정 요청은
          {' '}<a href="mailto:support@aiplace.kr">support@aiplace.kr</a> 로 보내 주세요.
        </p>
      </div>

      <div className="foot-meta">
        <span>{user.email ?? '로그인'} · 계정 ID #{user.id.slice(0, 8)}</span>
        <span>최근 동기화 · 방금</span>
      </div>
    </div>
  )
}

function labelFor(key: ContentTabKey): string {
  const map: Record<ContentTabKey, string> = {
    detail:  '업체 정보 블로그글',
    compare: '비교',
    guide:   '가이드',
    keyword: '키워드 페이지',
  }
  return map[key]
}
