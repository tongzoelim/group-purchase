'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import type { PostgrestError } from '@supabase/supabase-js'

type Profile = { is_admin: boolean }
type Round = { id: string; title: string }

export default function AdminNewProductPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [round, setRound] = useState<Round | null>(null)

  const [name, setName] = useState('')
  const [price, setPrice] = useState<number | ''>('')
  const [stock, setStock] = useState<number | ''>('')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 관리자 체크 + 회차 로드
  useEffect(() => {
    const init = async () => {
      setLoading(true)
      setError(null)

      const { getSupabase } = await import('@/lib/supabase')
      const supabase = getSupabase()

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

      const r = await supabase
        .from('rounds')
        .select('id,title')
        .eq('id', String(id))
        .single<Round>()
      if (r.error) {
        setError(r.error.message)
        setLoading(false)
        return
      }
      setRound(r.data)
      setLoading(false)
    }
    void init()
  }, [id, router])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { setError('상품명을 입력해주세요.'); return }
    const p = Number(price)
    const s = Number(stock)
    if (!Number.isFinite(p) || p < 0) { setError('단가는 0 이상의 숫자여야 합니다.'); return }
    if (!Number.isFinite(s) || s < 0) { setError('재고 한도는 0 이상의 숫자여야 합니다.'); return }

    setSubmitting(true)
    setError(null)
    try {
      const { getSupabase } = await import('@/lib/supabase')
      const supabase = getSupabase()

      const { error } = await supabase
        .from('products')
        .insert({
          round_id: String(id),
          name: name.trim(),
          price: p,
          stock_limit: s,
          stock_sold: 0,
        })

      if (error) {
        const e = error as PostgrestError
        setError(e.message)
        setSubmitting(false)
        return
      }
      router.replace(`/admin/rounds/${id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : '알 수 없는 오류')
      setSubmitting(false)
    }
  }

  if (loading) return <main className="p-6">불러오는 중…</main>
  if (!isAdmin) return (
    <main className="p-6">
      <div className="mb-4"><Link href="/admin" className="underline text-sm">← 관리자 홈</Link></div>
      <p className="text-red-600">접근 권한이 없습니다.</p>
    </main>
  )
  if (!round) return (
    <main className="p-6">
      <div className="mb-4"><Link href="/admin" className="underline text-sm">← 관리자 홈</Link></div>
      <p>회차를 찾을 수 없습니다.</p>
    </main>
  )

  return (
    <main className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">상품 등록</h1>
        <Link href={`/admin/rounds/${id}`} className="underline text-sm">← 회차 집계로</Link>
      </div>

      <div className="text-sm text-gray-600">
        회차: <span className="font-medium">{round.title}</span>
      </div>

      <form onSubmit={onSubmit} className="rounded border p-4 space-y-4 max-w-xl">
        <div>
          <label className="block text-sm font-medium">상품명</label>
          <input
            className="mt-1 w-full border rounded px-3 py-2"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="예: 컵라면(매운맛)"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium">단가(원)</label>
            <input
              type="number"
              className="mt-1 w-full border rounded px-3 py-2"
              value={price}
              onChange={e => setPrice(e.target.value === '' ? '' : Number(e.target.value))}
              min={0}
            />
          </div>
          <div>
            <label className="block text-sm font-medium">재고 한도(개)</label>
            <input
              type="number"
              className="mt-1 w-full border rounded px-3 py-2"
              value={stock}
              onChange={e => setStock(e.target.value === '' ? '' : Number(e.target.value))}
              min={0}
            />
          </div>
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className={`rounded px-4 py-2 ${submitting ? 'bg-gray-300' : 'bg-black text-white'}`}
        >
          {submitting ? '등록 중…' : '등록'}
        </button>
      </form>
    </main>
  )
}
