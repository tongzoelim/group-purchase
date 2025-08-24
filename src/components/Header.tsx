'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type SessionUser = { id: string; email?: string | null }

export default function Header() {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [safe, setSafe] = useState(false) // Supabase 호출 가능 여부

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    // 환경변수가 없으면 Supabase를 만지지 않고 안전 모드로 렌더
    if (!url || !key) {
      setSafe(false)
      return
    }
    setSafe(true)

    // 동적 import + try/catch
    const run = async () => {
      try {
        const { getSupabase } = await import('@/lib/supabase')
        const supabase = getSupabase()

        // 초기 세션
        supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null))
        // 상태 변경 구독
        const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
          setUser(session?.user ?? null)
        })
        return () => { sub.subscription.unsubscribe() }
      } catch {
        // 어떤 이유로든 실패하면 로그인 UI를 숨기고 안전 모드
        setSafe(false)
      }
    }
    run()
  }, [])

  return (
    <header className="border-b">
      <div className="max-w-4xl mx-auto p-4 flex items-center justify-between">
        <Link href="/" className="font-bold">공동구매 포털</Link>

        {/* 환경변수 없으면 로그인 UI를 숨긴 "안전 헤더" */}
        {!safe ? (
          <nav className="flex gap-4 text-sm">
            <Link href="/rounds" className="underline">회차 확인</Link>
          </nav>
        ) : !user ? (
          <nav className="flex gap-4 text-sm">
            <Link href="/rounds" className="underline">회차 확인</Link>
            <Link href="/login" className="underline">로그인</Link>
            <Link href="/signup" className="underline">회원가입</Link>
          </nav>
        ) : (
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/rounds" className="underline">회차 확인</Link>
            <Link href="/me" className="underline">내 프로필</Link>
            <button
              onClick={async () => {
                try {
                  const { getSupabase } = await import('@/lib/supabase')
                  const supabase = getSupabase()
                  await supabase.auth.signOut()
                  window.location.href = '/'
                } catch { /* noop */ }
              }}
              className="rounded border px-3 py-1"
            >
              로그아웃
            </button>
          </nav>
        )}
      </div>
    </header>
  )
}
