'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AdminLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    router.push('/admin')
    router.refresh()
  }

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-20 min-h-screen bg-[#f7f7f7]">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-[#222222] text-center mb-8">
          관리자 로그인
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-[#484848] mb-1">
              이메일
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full h-12 px-4 rounded-lg border border-[#dddddd] text-[#222222] focus:outline-none focus:ring-2 focus:ring-[#222222]"
              placeholder="admin@aiplace.kr"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-[#484848] mb-1">
              비밀번호
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full h-12 px-4 rounded-lg border border-[#dddddd] text-[#222222] focus:outline-none focus:ring-2 focus:ring-[#222222]"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-lg bg-[#222222] text-white font-medium hover:bg-[#333333] transition-colors disabled:opacity-50"
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>
      </div>
    </main>
  )
}
