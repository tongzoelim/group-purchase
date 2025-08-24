'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
export const dynamic = 'force-dynamic'

type SessionUser = { id: string; email?: string | null }

export default function Header() {
  const [user, setUser] = useState<SessionUser | null>(null)

  useEffect(() => {
    // 초기 세션 로드
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null))
    // 로그인/로그아웃 감지
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => { sub.subscription.unsubscribe() }
  }, [])

  const logout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/' // 홈으로
  }

  return (
    <header className="border-b">
      <div className="max-w-4xl mx-auto p-4 flex items-center justify-between">
        <Link href="/" className="font-bold">공동구매 포털</Link>

        {!user ? (
          <nav className="flex gap-4 text-sm">
            <Link href="/rounds" className="underline">회차 확인</Link>
            <Link href="/login" className="underline">로그인</Link>
            <Link href="/signup" className="underline">회원가입</Link>
          </nav>
        ) : (
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/rounds" className="underline">회차 확인</Link>
            <Link href="/me" className="underline">내 프로필</Link>
            <button onClick={logout} className="rounded border px-3 py-1">로그아웃</button>
          </nav>
        )}
      </div>
    </header>
  )
}
