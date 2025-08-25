'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Round = { id: string; title: string; deadline: string; status: 'open' | 'closed' }
type Profile = { is_admin: boolean }

export default function AdminHome() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState<boolean>(false)
  const [rounds, setRounds] = useState<Round[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }

      const pr = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single<Profile>()
      if (pr.error || !pr.data?.is_admin) {
        setIsAdmin(false)
        setLoading(false)
        return
      }
      setIsAdmin(true)

      const rr = await supabase
        .from('rounds')
        .select('id,title,deadline,status')
        .order('created_at', { ascending: false })
      if (rr.error) { setError(rr.error.message); setLoading(false); return }
      setRounds(rr.data ?? [])
      setLoading(false)
    }
    void load()
  }, [router])

  if (loading) return <main className="p-6">불러오는 중…</main>
  if (!isAdmin) return (
    <main className="p-6">
      <h1 className="text-2xl font-bold">관리자 메뉴</h1>
      <p className="mt-2 text-red-600">접근 권한이 없습니다.</p>
    </main>
  )

  return (
    <main className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">관리자 메뉴</h1>
        <Link href="/" className="underline text-sm">← 대시보드</Link>
      </div>

      {error && <p className="text-red-600">{error}</p>}

      <section className="rounded border p-4">
        <h2 className="font-semibold">회차 목록</h2>
        {rounds.length === 0 ? (
          <p className="text-sm text-gray-600 mt-2">회차가 없습니다.</p>
        ) : (
          <ul className="mt-3 divide-y">
            {rounds.map(r => (
              <li key={r.id} className="py-3 flex items-center justify-between">
                <div className="min-w-0">
                  <div className="font-medium">{r.title} <span className="text-xs text-gray-500">({r.status})</span></div>
                  <div className="text-xs text-gray-600">마감: {new Date(r.deadline).toLocaleString()}</div>
                </div>
                <div className="flex gap-3">
                  <Link href={`/admin/rounds/${r.id}`} className="underline text-sm">집계 보기</Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
<div className="flex items-center justify-between">
  <h1 className="text-2xl font-bold">관리자 메뉴</h1>
  <div className="flex items-center gap-3">
    <Link href="/admin/rounds/new" className="text-sm rounded border px-3 py-1">회차 등록</Link>
    <Link href="/" className="underline text-sm">← 대시보드</Link>
  </div>
</div>