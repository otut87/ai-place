import Link from 'next/link'

interface AuthorCardProps {
  variant?: 'byline' | 'card'
}

const AUTHOR = {
  name: '이지수',
  jobTitle: 'AI Place 큐레이터',
  bio: '천안 지역 로컬 업체의 AI 검색 노출을 돕고 있습니다.',
  url: '/about',
}

/** 바이라인: H1 아래 한 줄 표시 */
export function AuthorByline() {
  return (
    <span className="text-xs text-[#6a6a6a]">
      작성자: <Link href={AUTHOR.url} className="hover:text-[#008f6b]">{AUTHOR.name}</Link> · {AUTHOR.jobTitle}
    </span>
  )
}

/** 저자 카드: 글 하단 표시 */
export function AuthorCard({ variant = 'card' }: AuthorCardProps) {
  if (variant === 'byline') return <AuthorByline />

  return (
    <div className="mt-12 p-5 bg-[#f2f2f2] rounded-[14px] flex items-start gap-4">
      <div className="w-10 h-10 rounded-full bg-[#008f6b] flex items-center justify-center text-white text-sm font-bold shrink-0">
        {AUTHOR.name[0]}
      </div>
      <div>
        <Link href={AUTHOR.url} className="text-sm font-semibold text-[#222222] hover:text-[#008f6b]">
          {AUTHOR.name}
        </Link>
        <p className="text-xs text-[#6a6a6a] mt-0.5">{AUTHOR.jobTitle}</p>
        <p className="text-xs text-[#6a6a6a] mt-1">{AUTHOR.bio}</p>
      </div>
    </div>
  )
}
