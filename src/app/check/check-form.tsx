'use client'

// T-136 — 공개 진단 URL 입력 폼.
// 제출 시 /check?url=... 로 이동해 서버가 진단 후 렌더.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Loader2 } from 'lucide-react'

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
    <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9a9a9a]" />
        <input
          type="url"
          placeholder="https://my-business.com 또는 my-business.com"
          value={url}
          onChange={e => setUrl(e.target.value)}
          className="h-12 w-full rounded-lg border border-[#dddddd] bg-white pl-10 pr-3 text-sm focus:border-[#008060] focus:outline-none"
          required
        />
      </div>
      <button
        type="submit"
        disabled={loading || !url.trim()}
        className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-[#008060] px-6 text-sm font-medium text-white hover:bg-[#006b4f] disabled:opacity-60"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        {loading ? '진단 중…' : '진단 시작'}
      </button>
    </form>
  )
}
