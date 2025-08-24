'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Round = { id: string; title: string; deadline: string; status: 'open'|'closed' }
type Product = { id: string; name: string; price: number; visible: boolean; sort_order: number }

export default function RoundDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [round, setRound] = useState<Round | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    const load = async () => {
      setLoading(true); setError(null)
      const [{ data: r, error: rErr }, { data: p, error: pErr }] = await Promise.all([
        supabase.from('rounds').select('id,title,deadline,status').eq('id', id).single(),
        supabase.from('products').select('id,name,price,visible,sort_order').eq('round_id', String(id)).eq('visible', true).order('sort_order', { ascending: true }),
      ])
      if (rErr) { setError(rErr.message); setLoading(false); return }
      setRound(r ?? null)
      if (pErr) { setError(pErr.message); setLoading(false); return }
      setProducts(p ?? [])
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) return <main className="p-6">불러오는 중…</main>
  if (error) return <main className="p-6 text-red-600">오류: {error}</main>
  if (!round) return <main className="p-6">해당 회차를 찾을 수 없습니다.</main>

  return (
    <main className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{round.title}</h1>
          <p className="text-sm text-gray-600">마감: {new Date(round.deadline).toLocaleString()} · 상태: {round.status === 'open' ? '진행중' : '마감'}</p>
        </div>
        <Link href="/rounds" className="underline text-sm">← 회차 목록</Link>
      </div>

      {products.length === 0 ? (
        <p>이 회차에 표시할 상품이 없습니다.</p>
      ) : (
        <ul className="grid md:grid-cols-2 gap-4">
          {products.map(p => (
            <li key={p.id} className="rounded border p-4">
              <div className="font-semibold">{p.name}</div>
              <div className="text-sm text-gray-600 mt-1">{p.price.toLocaleString()}원</div>
              {/* 다음 단계에서: 수량 스테퍼/주문 저장 버튼 추가 */}
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
