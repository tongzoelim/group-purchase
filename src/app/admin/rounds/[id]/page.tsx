'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { PostgrestError } from '@supabase/supabase-js'

type Round = { id: string; title: string; deadline: string; status: 'open' | 'closed' }
type Profile = { is_admin: boolean }

type UserRow = {
  user_id: string
  name: string | null
  email: string | null
  total_qty: number
  total_amount: number
  updated_at: string
}
type ProductRow = {
  product_id: string
  name: string
  unit_price: number
  total_qty: number
  total_amount: number
}

export default function AdminRoundPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState<boolean>(false)
  const [round, setRound] = useState<Round | null>(null)

  const [users, setUsers] = useState<UserRow[]>([])
  const [products, setProducts] = useState<ProductRow[]>([])
  const [error, setError] = useState<string | null>(null)

  const totalAmountAll = useMemo(
    () => users.reduce((s, u) => s + (u.total_amount || 0), 0),
    [users]
  )
  const totalQtyAll = useMemo(
    () => users.reduce((s, u) => s + (u.total_qty || 0), 0),
    [users]
  )

  useEffect(() => {
    const load = async () => {
      if (!id) return
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

      const r1 = await supabase
        .from('rounds')
        .select('id,title,deadline,status')
        .eq('id', String(id))
        .single<Round>()
      if (r1.error) { setError(r1.error.message); setLoading(false); return }
      setRound(r1.data)

      const u = await supabase.rpc('admin_round_user_totals', { p_round: String(id) })
      const p = await supabase.rpc('admin_round_product_totals', { p_round: String(id) })

      if (u.error) { const e = u.error as PostgrestError; setError(`사용자 합계 로딩 오류: ${e.message}`); setLoading(false); return }
      if (p.error) { const e = p.error as PostgrestError; setError(`상품 합계 로딩 오류: ${e.message}`); setLoading(false); return }

      setUsers((u.data ?? []) as unknown as UserRow[])
      setProducts((p.data ?? []) as unknown as ProductRow[])
      setLoading(false)
    }
    void load()
  }, [id, router])

  if (loading) return <main className="p-6">불러오는 중…</main>
  if (!isAdmin) return (
    <main className="p-6">
      <h1 className="text-2xl font-bold">관리자 메뉴</h1>
      <p className="mt-2 text-red-600">접근 권한이 없습니다.</p>
    </main>
  )
  if (error) return (
    <main className="p-6">
      <div className="mb-4"><Link className="underline text-sm" href="/admin">← 관리자 홈</Link></div>
      <p className="text-red-600">{error}</p>
    </main>
  )
  if (!round) return (
    <main className="p-6">
      <div className="mb-4"><Link className="underline text-sm" href="/admin">← 관리자 홈</Link></div>
      <p>회차를 찾을 수 없습니다.</p>
    </main>
  )

  return (
    <main className="p-6 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{round.title}</h1>
          <p className="text-sm text-gray-600">
            마감: {new Date(round.deadline).toLocaleString()} · 상태: {round.status}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* ✅ 상품 등록 버튼 */}
          <Link href={`/admin/rounds/${round.id}/products/new`} className="text-sm rounded border px-3 py-1">
            상품 등록
          </Link>
          <Link className="underline text-sm" href="/admin">← 관리자 홈</Link>
        </div>
      </div>

      {/* 사용자별 합계 */}
      <section className="rounded border p-4">
        <h2 className="font-semibold mb-3">사용자별 합계</h2>
        {users.length === 0 ? (
          <p className="text-sm text-gray-600">제출된 주문이 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[720px] w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left p-2">이름</th>
                  <th className="text-left p-2">이메일</th>
                  <th className="text-right p-2">총 수량</th>
                  <th className="text-right p-2">총 금액(원)</th>
                  <th className="text-left p-2">최종 수정</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.user_id} className="border-b">
                    <td className="p-2">{u.name ?? '-'}</td>
                    <td className="p-2">{u.email ?? '-'}</td>
                    <td className="p-2 text-right">{u.total_qty}</td>
                    <td className="p-2 text-right">{u.total_amount.toLocaleString()}</td>
                    <td className="p-2">{new Date(u.updated_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t font-semibold">
                  <td className="p-2" colSpan={2}>전체 합계</td>
                  <td className="p-2 text-right">{totalQtyAll}</td>
                  <td className="p-2 text-right">{totalAmountAll.toLocaleString()}</td>
                  <td className="p-2"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        <p className="text-xs text-gray-600 mt-2">※ “1인당 내야 할 돈” = 각 행의 “총 금액(원)”입니다.</p>
      </section>

      {/* 상품별 합계 */}
      <section className="rounded border p-4">
        <h2 className="font-semibold mb-3">상품별 합계</h2>
        {products.length === 0 ? (
          <p className="text-sm text-gray-600">상품이 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[720px] w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left p-2">상품명</th>
                  <th className="text-right p-2">단가(원)</th>
                  <th className="text-right p-2">총 수량</th>
                  <th className="text-right p-2">총 금액(원)</th>
                </tr>
              </thead>
              <tbody>
                {products.map(p => (
                  <tr key={p.product_id} className="border-b">
                    <td className="p-2">{p.name}</td>
                    <td className="p-2 text-right">{p.unit_price.toLocaleString()}</td>
                    <td className="p-2 text-right">{p.total_qty}</td>
                    <td className="p-2 text-right">{p.total_amount.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  )
}
