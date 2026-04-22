// /owner/content 콘텐츠 카드.
// 모든 아이템은 "블로그글(/blog/…)" — post_type 으로 탭 분류.
// detail 은 특정 업체 1곳을 주인공으로 한 심층 블로그글 ("주요 업체" 로 표시).

import type { OwnerContentItem, ContentTabKey } from '@/lib/owner/content-mentions'
import type { OwnerPlaceRow } from '@/lib/actions/owner-places'

interface Props {
  item: OwnerContentItem
  placesById: Map<string, OwnerPlaceRow>
  /** 이 path 에 기록된 AI 봇 방문 수 (bot_visits 기반, 90d). 0 이면 표시 생략. */
  citationCount: number
}

// contentType=null(=general) 도 렌더. 라벨은 '일반' 으로.
type DisplayKey = ContentTabKey | 'general'

const TAB_LABELS: Record<DisplayKey, { short: string; long: string }> = {
  detail:  { short: '업체 정보',     long: 'BLOG · 업체 심층' },
  compare: { short: '비교',          long: 'BLOG · 비교' },
  guide:   { short: '가이드',        long: 'BLOG · 선택 가이드' },
  keyword: { short: '키워드 페이지', long: 'BLOG · 키워드 랜딩' },
  general: { short: '일반',          long: 'BLOG · 일반' },
}

const SECTOR_GRADIENTS = new Set([
  'food', 'medical', 'beauty', 'living', 'auto', 'education',
  'pet', 'wedding', 'leisure', 'professional', 'general',
])

export function ContentCard({ item, placesById, citationCount }: Props) {
  const { path, contentType, postType, placeIds, title, summary, tags, charCount, sector, status, publishedAt, thumbnailUrl } = item

  const displayKey: DisplayKey = contentType ?? 'general'
  const tab = TAB_LABELS[displayKey]
  const isDetailPost = postType === 'detail' // 특정 업체 1곳 주인공

  const displayTitle = title ?? fallbackTitle(path, displayKey)
  const displayExcerpt = summary ?? fallbackExcerpt(displayKey)
  const isActive = status === 'active' || status === null // seed 는 null → 공개
  const gradientKey = sector && SECTOR_GRADIENTS.has(sector) ? sector : 'general'
  const bigLetter = bigLetterFor(displayTitle, sector, displayKey)
  const readingMinutes = charCount > 0 ? Math.max(1, Math.round(charCount / 500)) : 0
  const hashTags = (tags && tags.length > 0) ? tags.slice(0, 4).map((t) => `#${t}`).join(' ') : null

  const mentionedPlaces = placeIds.map((id) => placesById.get(id)).filter(Boolean) as OwnerPlaceRow[]

  return (
    <article className="c-item">
      <div className="thumb">
        {thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="kimg" src={thumbnailUrl} alt="" loading="lazy" />
        ) : (
          <div className={`kbg ${gradientKey}`} />
        )}
        <div className="overlay" />
        <span className="cat-lbl"><i /> {tab.long}</span>
        {bigLetter && <span className="big-letter">{bigLetter}</span>}
        {publishedAt && (
          <span className="pub-date"><i /> {formatPubDate(publishedAt)} 발행</span>
        )}
      </div>

      <div className="body">
        <div className="topline">
          <span className="pill">{tab.short}</span>
          {hashTags && <span>{hashTags}</span>}
          {(charCount > 0 || readingMinutes > 0) && (
            <span className="stats-inline">
              {charCount > 0 && <>{charCount.toLocaleString('ko-KR')}자</>}
              {charCount > 0 && readingMinutes > 0 && ' · '}
              {readingMinutes > 0 && <>읽기 {readingMinutes}분</>}
            </span>
          )}
        </div>

        <h3>
          {isActive ? (
            <a href={path} target="_blank" rel="noopener noreferrer">{displayTitle}</a>
          ) : (
            <span>{displayTitle}</span>
          )}
        </h3>

        {displayExcerpt && <p className="excerpt">{displayExcerpt}</p>}

        <div className="meta">
          <div className="m" style={{ gridColumn: 'span 2' }}>
            <span className="l">
              {isDetailPost ? '주요 업체' : `언급된 업체 · ${mentionedPlaces.length}곳`}
            </span>
            <span className="biz-caption">
              <span className="dot" />
              {mentionedPlaces.length === 0 ? (
                <span className="sub">(알 수 없음)</span>
              ) : mentionedPlaces.map((p, i) => (
                <span key={p.id}>
                  <span className="b">{p.name}</span>
                  {p.category && <span className="sub">· {p.category}</span>}
                  {i < mentionedPlaces.length - 1 && <span className="sep">·</span>}
                </span>
              ))}
            </span>
          </div>
          <div className="m" style={{ gridColumn: 'span 2' }}>
            <span className="l">상태 · 발행일</span>
            <span className="v">
              <b style={{ color: isActive ? 'var(--good)' : 'var(--warn)' }}>
                ● {isActive ? '공개' : (status ?? '대기')}
              </b>
              {publishedAt && <> · {formatPubDate(publishedAt)}</>}
              {citationCount > 0 && <> · 최근 AI 인용 <b>{citationCount}회</b></>}
            </span>
          </div>
        </div>

        <div className="foot">
          <span className="url" title={path}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.72" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.72-1.72" />
            </svg>
            aiplace.kr{path}
          </span>
          {isActive && (
            <div className="actions">
              <a href={path} target="_blank" rel="noopener noreferrer" className="btn primary">
                보기
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path d="M7 17L17 7M7 7h10v10" />
                </svg>
              </a>
            </div>
          )}
        </div>
      </div>
    </article>
  )
}

function formatPubDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
}

function fallbackTitle(path: string, key: DisplayKey): string {
  const last = path.split('/').filter(Boolean).pop() ?? path
  const decoded = decodeURIComponent(last)
  if (key === 'detail')  return `업체 심층: ${decoded}`
  if (key === 'compare') return `비교: ${decoded}`
  if (key === 'guide')   return `가이드: ${decoded}`
  if (key === 'keyword') return `키워드: ${decoded}`
  return decoded
}

function fallbackExcerpt(key: DisplayKey): string {
  if (key === 'detail')  return '특정 업체 1곳을 주인공으로 한 심층 블로그글. AI 가 해당 업체에 대한 구체 질문에 참고합니다.'
  if (key === 'compare') return '업체 vs 업체 비교 기사. AI 가 "A 와 B 중 어디가 좋아요?" 질문에 참고합니다.'
  if (key === 'guide')   return '시술·서비스별 선택 가이드. AI 가 "무엇을 기준으로 골라야 하나요?" 질문에 참고합니다.'
  if (key === 'keyword') return '지역+업종 랜딩. AI 가 지역 기반 질문에 참고하는 후보 리스트입니다.'
  return ''
}

function bigLetterFor(title: string, sector: string | null, key: DisplayKey): string {
  if (sector) {
    const map: Record<string, string> = {
      food: 'Fd', medical: 'Md', beauty: 'Bt', living: 'Lv', auto: 'Au',
      education: 'Ed', pet: 'Pt', wedding: 'Wd', leisure: 'Ls', professional: 'Pr',
    }
    if (map[sector]) return map[sector]
  }
  if (key === 'detail')  return 'Bz'
  if (key === 'compare') return 'Cm'
  if (key === 'guide')   return 'Gd'
  if (key === 'keyword') return 'Kw'
  const first = title.trim().charAt(0)
  return first ? first.toUpperCase() : 'An'
}
