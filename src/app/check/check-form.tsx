'use client'

// /check 진단 URL 입력 폼 (T-245 paper/orange aip 리믹스).
// 제출 시 /check?url=... 로 이동해 서버가 진단 후 렌더.

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export function CheckForm({ initialUrl }: { initialUrl: string }) {
  const router = useRouter()
  const [url, setUrl] = useState(initialUrl)
  // useTransition: router.push 의 서버 렌더가 끝나면 isPending 자동 false.
  // (useState + setLoading 패턴은 push 후 컴포넌트가 unmount 되지 않아 리셋 안 됨)
  const [loading, startTransition] = useTransition()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!url.trim()) return
    startTransition(() => {
      router.push(`/check?url=${encodeURIComponent(url.trim())}`)
    })
  }

  return (
    <form className="au-form" onSubmit={submit}>
      <div className="form-num">
        DIAGNOSTIC · <b>FREE</b>
      </div>

      <label htmlFor="check-url">진단할 페이지 URL</label>
      <p className="hint">
        업체 홈페이지 · 자체 사이트 · AI Place 업체 페이지 모두 가능. 사이트맵이 있으면 고유 경로 8개까지 자동 스캔합니다.
      </p>

      <div className="url-row">
        <input
          id="check-url"
          type="url"
          placeholder="https://my-business.com"
          value={url}
          onChange={e => setUrl(e.target.value)}
          required
          disabled={loading}
        />
        <button className="btn-go" type="submit" disabled={loading || !url.trim()}>
          {loading ? '진단 중...' : '진단 시작 →'}
        </button>
      </div>

      <div className="meta-strip">
        <span>예상 소요 <b>30초</b></span>
        <span>익명 저장 <span className="ac">●</span></span>
        <span>로그인 <b>불필요</b></span>
        <span>API 비용 <b>0원</b></span>
      </div>
      <p className="meta-note">
        진단 후 점수 추이 비교를 위해 도메인+경로(쿼리/토큰 제외)와 점수만 저장합니다. 자세한 항목은{' '}
        <Link href="/privacy" className="underline">개인정보처리방침</Link>.
      </p>
    </form>
  )
}
