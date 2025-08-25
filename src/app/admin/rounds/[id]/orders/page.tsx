'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import type { PostgrestError } from '@supabase/supabase-js'

type Profile = { is_admin: boolean }
type Round = { id: string; title: string }

type Row = {
  user_id: string
  name: string | null
  email: string | null
  order_updated_at: string
  product_id: string
  product_name: string
  unit_price: number
  qty: number
  amount: number
}

export default function AdminRoundOrdersDetail() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [round, setRound] = useState<Round | null>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('') // 간단 검색

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return rows
    return rows.filter(r =>
      (r.name ?? '').toLowerCase().includes(s) ||
      (r.email ?? '').toLowerCase().includes(s) ||
      (r.product_name ?? '').toLowerCase().includes(s)
    )
  }, [rows, q])

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      setError(null)
      const { getSupabase } = await import('@/lib/supabase')
      const supabase = getSupabase()

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }

      const pr = await supabase.from('profiles').select('is_admin').eq('id', user.id).single<Profile>()
      if (pr.error || !pr.data?.is_admin) { setIsAdmin(false); setLoading(false); return }
      setIsAdmin(true)

      const r1 = await supabase.from('rounds').select('id,title').eq('id', String(id)).single<Round>()
      if (r1.error) { setError(r1.error.message); setLoading(false); return }
      setRound(r1.data)

      const resp = await supabase.rpc('admin_round_order_items', { p_round: String(id) })
      if (resp.error) {
        const e = resp.error as PostgrestError
        setError(e.message); setLoading(false); return
      }
      setRows((resp.data ?? []) as unknown as Row[])
      setLoading(false)
    }
    void run()
  }, [id, router])

  if (loading) return <main className="p-6">불러오는 중…</main>
  if (!isAdmin) return (
    <main className="p-6">
      <h1 className="text-2xl font-bold">관리자 · 주문 상세</h1>
      <p className="mt-2 text-red-600">접근 권한이 없습니다.</p>
    </main>
  )
  if (error) return (
    <main className="p-6">
      <div className="mb-4"><Link href="/admin/rounds" className="underline text-sm">← 회차 목록</Link></div>
      <p className="text-red-600">{error}</p>
    </main>
  )

  // 사용자 → 그 사용자의 상품 목록 형태로 묶어서 보여주기
  const grouped = new Map<string, { user: { name: string|null; email: string|null }; items: Row[]; total: number }>()
  for (const r of filtered) {
    const key = r.user_id
    if (!grouped.has(key)) grouped.set(key, { user: { name: r.name, email: r.email }, items: [], total: 0 })
    const g = grouped.get(key)!
    g.items.push(r)
    g.total += r.amount
  }

  return (
    <main className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">주문 상세 · {round?.title ?? ''}</h1>
        <div className="flex items-center gap-3">
          <Link href={`/admin/rounds/${id}`} className="underline text-sm">← 집계</Link>
          <Link href="/admin/rounds" className="underline text-sm">회차 목록</Link>
        </div>
      </div>

      <div className="flex gap-2">
        <input
          value={q}
          onChange={(e)=>setQ(e.target.value)}
          placeholder="이름/이메일/상품명 검색"
          className="border rounded px-3 py-2 w-full max-w-sm"
        />
      </div>

      {[...grouped.entries()].length === 0 ? (
        <p className="text-sm text-gray-600">데이터가 없습니다.</p>
      ) : (
        <div className="space-y-6">
          {[...grouped.entries()].map(([uid, g]) => (
            <section key={uid} className="rounded border p-4">
              <div className="flex items-center justify-between">
                <div className="font-semibold">{g.user.name ?? '(이름없음)'} <span className="text-xs text-gray-600">· {g.user.email ?? '-'}</span></div>
                <div className="text-sm">합계: <span className="font-semibold">{g.total.toLocaleString()}</span> 원</div>
              </div>
              <div className="overflow-x-auto mt-3">
                <table className="min-w-[640px] w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left p-2">상품명</th>
                      <th className="text-right p-2">단가</th>
                      <th className="text-right p-2">수량</th>
                      <th className="text-right p-2">금액</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.items.map(it => (
                      <tr key={it.product_id} className="border-b">
                        <td className="p-2">{it.product_name}</td>
                        <td className="p-2 text-right">{it.unit_price.toLocaleString()}</td>
                        <td className="p-2 text-right">{it.qty}</td>
                        <td className="p-2 text-right">{it.amount.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  )
}
