// src/app/admin/page.tsx
'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

type ProductRow = {
  id: string; name: string; price: number;
  stock_limit: number; stock_sold: number; stock_remaining: number;
  round_id: string;
}

export default function AdminPage() {
  const router = useRouter()
  const [ok, setOk] = useState<boolean | null>(null)
  const [rows, setRows] = useState<ProductRow[]>([])
  const [msg, setMsg] = useState('')

  useEffect(() => {
    const run = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }
      const { data: me } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
      if (!me?.is_admin) { router.replace('/'); return }
      setOk(true)

      const { data, error } = await supabase
        .from('product_availability')
        .select('product_id, round_id, name, price, stock_limit, stock_sold, stock_remaining')
        .order('name', { ascending: true })
      if (error) setMsg(error.message)
      else setRows((data ?? []).map(d => ({
        id: d.product_id, name: d.name, price: d.price,
        stock_limit: d.stock_limit, stock_sold: d.stock_sold, stock_remaining: d.stock_remaining,
        round_id: d.round_id
      })))
    }
    run()
  }, [router])

  if (ok === null) return <main className="p-6">확인 중…</main>
  if (!ok) return null

  const updateLimit = async (id: string, newLimit: number) => {
    setMsg('')
    const { error } = await supabase.from('products').update({ stock_limit: newLimit }).eq('id', id)
    if (error) setMsg(error.message)
    else {
      // 갱신
      const { data } = await supabase
        .from('product_availability')
        .select('product_id, round_id, name, price, stock_limit, stock_sold, stock_remaining')
        .order('name', { ascending: true })
      setRows((data ?? []).map(d => ({
        id: d.product_id, name: d.name, price: d.price,
        stock_limit: d.stock_limit, stock_sold: d.stock_sold, stock_remaining: d.stock_remaining,
        round_id: d.round_id
      })))
    }
  }

  return (
    <main className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">관리자 설정</h1>
      <p className="text-sm text-gray-600">상품별 총한도(재고)를 설정하고, 남은 수량을 확인합니다.</p>

      <table className="w-full text-sm border">
        <thead>
          <tr className="bg-gray-50">
            <th className="p-2 border">회차</th>
            <th className="p-2 border">상품</th>
            <th className="p-2 border">가격</th>
            <th className="p-2 border">총한도</th>
            <th className="p-2 border">판매누계</th>
            <th className="p-2 border">남은수량</th>
            <th className="p-2 border">수정</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id}>
              <td className="p-2 border"><Link className="underline" href={`/rounds/${r.round_id}`}>{r.round_id.slice(0,8)}</Link></td>
              <td className="p-2 border">{r.name}</td>
              <td className="p-2 border">{r.price.toLocaleString()}원</td>
              <td className="p-2 border">
                <input
                  type="number"
                  className="w-24 border rounded px-2 py-1"
                  defaultValue={r.stock_limit}
                  onBlur={(e)=>updateLimit(r.id, Math.max(0, parseInt(e.target.value || '0', 10)))}
                />
              </td>
              <td className="p-2 border">{r.stock_sold}</td>
              <td className="p-2 border">{r.stock_remaining}</td>
              <td className="p-2 border"><button className="border rounded px-2 py-1" onClick={()=>{
                const el = (document.activeElement as HTMLInputElement)
                el?.blur()
              }}>적용</button></td>
            </tr>
          ))}
        </tbody>
      </table>

      {msg && <p className="text-red-600">{msg}</p>}
    </main>
  )
}
