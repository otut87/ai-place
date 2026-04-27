'use client'

// /check 진단 URL 입력 폼 (T-245 paper/orange aip 리믹스).
// 제출 시 /check?url=... 로 이동해 서버가 진단 후 렌더.

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function CheckForm({ initialUrl }: { initialUrl: string }) {
  const router = useRouter()
  const [url, setUrl] = useState(initialUrl)
  const [loading, setLoading] = useState(false)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!url.trim()) return
    setLoading(true)
    router.push(`/check?url=${encodeURIComponent(url.trim())}`)
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
        <span>저장하지 않음 <span className="ac">●</span></span>
        <span>로그인 <b>불필요</b></span>
        <span>API 비용 <b>0원</b></span>
      </div>
    </form>
  )
}
