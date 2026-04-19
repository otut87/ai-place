'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) {
      setError(authError.message)
      setPending(false)
      return
    }
    router.push('/owner')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-[#484848]">이메일</label>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          className="mt-1 h-11 w-full rounded-lg border border-[#dddddd] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#008060]"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-[#484848]">비밀번호</label>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          className="mt-1 h-11 w-full rounded-lg border border-[#dddddd] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#008060]"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="h-11 w-full rounded-lg bg-[#008060] text-sm font-medium text-white transition-colors hover:bg-[#006e52] disabled:opacity-50"
      >
        {pending ? '로그인 중...' : '로그인'}
      </button>
    </form>
  )
}
