'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

type Round = { id: string; title: string; deadline: string; status: 'open'|'closed' }
type Product = { id: string; round_id: string; name: string; price: number; visible: boolean; sort_order: number }

export default function ProductsPage() {
  const [round, setRound] = useState<Round | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)

      // 현재 open 상태인 라운드 1개 가져오기
      const { data: rounds, error: rErr } = await supabase
        .from('rounds')
        .select('*')
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(1)

      if (rErr) { setError(rErr.message); setLoading(false); return }
      const current = rounds?.[0]
      setRound(current ?? null)

      if (current) {
        const { data: prods, error: pErr } = await supabase
          .from('products')
          .select('*')
          .eq('round_id', current.id)
          .eq('visible', true)
          .order('sort_order', { ascending: true })

        if (pErr) { setError(pErr.message); setLoading(false); return }
        setProducts(prods ?? [])
      }

      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <main className="p-6">불러오는 중…</main>
  if (error) return <main className="p-6 text-red-600">오류: {error}</main>

  return (
    <main className="max-w-3xl mx-auto p-6">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">상품 선택</h1>
          {round && <p className="text-sm text-gray-600">{round.title} · 마감: {new Date(round.deadline).toLocaleString()}</p>}
        </div>
        <Link href="/login" className="underline">로그인</Link>
      </header>

      {(!round || products.length === 0) ? (
        <p>현재 선택할 수 있는 상품이 없습니다.</p>
      ) : (
        <ul className="grid md:grid-cols-2 gap-4">
          {products.map((p) => (
            <li key={p.id} className="rounded border p-4">
              <div className="font-semibold">{p.name}</div>
              <div className="text-sm text-gray-600 mt-1">{p.price.toLocaleString()}원</div>
              <div className="mt-3 text-xs text-gray-500">※ 수량 선택/주문 저장은 다음 단계에서 붙입니다.</div>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
