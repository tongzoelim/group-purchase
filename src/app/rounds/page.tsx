'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Round = { id: string; title: string; deadline: string; status: 'open'|'closed' }

export default function RoundsPage() {
  const [openRounds, setOpenRounds] = useState<Round[]>([])
  const [closedRounds, setClosedRounds] = useState<Round[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true); setError(null)
      const { data, error } = await supabase
        .from('rounds')
        .select('id, title, deadline, status')
        .order('created_at', { ascending: false })
      if (error) { setError(error.message); setLoading(false); return }
      setOpenRounds((data ?? []).filter(r => r.status === 'open'))
      setClosedRounds((data ?? []).filter(r => r.status === 'closed'))
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <main className="p-6">불러오는 중…</main>
  if (error) return <main className="p-6 text-red-600">오류: {error}</main>

  return (
    <main className="p-6 space-y-8">
      <h1 className="text-2xl font-bold">회차 확인</h1>

      <section>
        <h2 className="font-semibold mb-3">열린 회차</h2>
        {openRounds.length === 0 ? (
          <p className="text-sm text-gray-600">현재 열린 회차가 없습니다.</p>
        ) : (
          <ul className="grid md:grid-cols-2 gap-3">
            {openRounds.map(r => (
              <li key={r.id} className="rounded border p-4">
                <div className="font-medium">{r.title}</div>
                <div className="text-xs text-gray-600 mt-1">마감: {new Date(r.deadline).toLocaleString()}</div>
                <Link href={`/rounds/${r.id}`} className="mt-2 inline-block text-sm underline">이 회차 상품 보기</Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-semibold mb-3">마감된 회차</h2>
        {closedRounds.length === 0 ? (
          <p className="text-sm text-gray-600">표시할 마감된 회차가 없습니다.</p>
        ) : (
          <ul className="grid md:grid-cols-2 gap-3">
            {closedRounds.map(r => (
              <li key={r.id} className="rounded border p-4 opacity-75">
                <div className="font-medium">{r.title}</div>
                <div className="text-xs text-gray-600 mt-1">마감: {new Date(r.deadline).toLocaleString()}</div>
                <Link href={`/rounds/${r.id}`} className="mt-2 inline-block text-sm underline">상세 보기</Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
