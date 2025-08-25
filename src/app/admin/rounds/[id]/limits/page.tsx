'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import type { PostgrestError } from '@supabase/supabase-js'

type Profile = { is_admin: boolean }
type Round = { id: string; title: string }
type Product = { id: string; name: string; price: number; stock_limit: number; stock_sold: number }

export default function AdminRoundLimits() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [round, setRound] = useState<Round | null>(null)
  const [rows, setRows] = useState<Product[]>([])
  const [draft, setDraft] = useState<Record<string, { price: number; stock_limit: number }>>({})
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      setError(null); setMsg(null)
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

      const p1 = await supabase
        .from('products')
        .select('id,name,price,stock_limit,stock_sold')
        .eq('round_id', String(id))
        .order('name', { ascending: true })

      if (p1.error) { const e = p1.error as PostgrestError; setError(e.message); setLoading(false); return }
      const list = (p1.data ?? []) as unknown as Product[]
      setRows(list)
      // 초안 값 초기화
      const d: Record<string, { price: number; stock_limit: number }> = {}
      for (const it of list) d[it.id] = { price: it.price, stock_limit: it.stock_limit }
      setDraft(d)
      setLoading(false)
    }
    void run()
  }, [id, router])

  const onChange = (pid: string, key: 'price'|'stock_limit', v: string) => {
    const n = Math.max(0, parseInt(v || '0', 10) || 0)
    setDraft(prev => ({ ...prev, [pid]: { ...prev[pid], [key]: n } }))
  }

  const onSave = async () => {
    setSaving(true); setMsg(null); setError(null)
    try {
      const { getSupabase } = await import('@/lib/supabase')
      const supabase = getSupabase()

      for (const p of rows) {
        const next = draft[p.id]
        if (!next) continue
        if (next.price === p.price && next.stock_limit === p.stock_limit) continue
        const { error } = await supabase
          .from('products')
          .update({ price: next.price, stock_limit: next.stock_limit })
          .eq('id', p.id)
        if (error) throw error
      }
      setMsg('저장 완료!')
    } catch (e) {
      const msg = e instanceof Error ? e.message : '알 수 없는 오류'
      setError(`저장 실패: ${msg}`)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <main className="p-6">불러오는 중…</main>
  if (!isAdmin) return (
    <main className="p-6">
      <h1 className="text-2xl font-bold">관리자 · 한도/단가 관리</h1>
      <p className="mt-2 text-red-600">접근 권한이 없습니다.</p>
    </main>
  )
  if (error) return (
    <main className="p-6">
      <div className="mb-4"><Link className="underline text-sm" href="/admin/rounds">← 회차 목록</Link></div>
      <p className="text-red-600">{error}</p>
    </main>
  )

  return (
    <main className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">한도/단가 관리 · {round?.title ?? ''}</h1>
        <div className="flex items-center gap-3">
          <Link href={`/admin/rounds/${id}`} className="underline text-sm">← 집계</Link>
          <Link href="/admin/rounds" className="underline text-sm">회차 목록</Link>
        </div>
      </div>

      {msg && <p className="text-green-700">{msg}</p>}
      {error && <p className="text-red-600">{error}</p>}

      {rows.length === 0 ? (
        <p className="text-sm text-gray-600">상품이 없습니다. 우상단 “상품 등록”으로 추가하세요.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-[760px] w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left p-2">상품명</th>
                <th className="text-right p-2">현재 단가</th>
                <th className="text-right p-2">현재 한도</th>
                <th className="text-right p-2">판매 수량</th>
                <th className="text-right p-2">새 단가</th>
                <th className="text-right p-2">새 한도</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(p => (
                <tr key={p.id} className="border-b">
                  <td className="p-2">{p.name}</td>
                  <td className="p-2 text-right">{p.price.toLocaleString()}</td>
                  <td className="p-2 text-right">{p.stock_limit}</td>
                  <td className="p-2 text-right">{p.stock_sold}</td>
                  <td className="p-2 text-right">
                    <input
                      type="number"
                      className="w-28 border rounded px-2 py-1 text-right"
                      value={draft[p.id]?.price ?? 0}
                      onChange={(e)=>onChange(p.id,'price',e.target.value)}
                      min={0}
                    />
                  </td>
                  <td className="p-2 text-right">
                    <input
                      type="number"
                      className="w-24 border rounded px-2 py-1 text-right"
                      value={draft[p.id]?.stock_limit ?? 0}
                      onChange={(e)=>onChange(p.id,'stock_limit',e.target.value)}
                      min={0}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4">
            <button
              disabled={saving}
              onClick={onSave}
              className={`rounded px-4 py-2 ${saving ? 'bg-gray-300' : 'bg-black text-white'}`}
            >
              {saving ? '저장 중…' : '변경 사항 저장'}
            </button>
          </div>
        </div>
      )}
    </main>
  )
}
