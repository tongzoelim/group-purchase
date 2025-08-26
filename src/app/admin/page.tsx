'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type Profile = { is_admin: boolean }
type Overview = {
  total_users: number
  total_rounds: number
  total_orders_submitted: number
  distinct_submitters: number
  participation_rate: number
}

export default function AdminHub() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [ov, setOv] = useState<Overview | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const run = async () => {
      setLoading(true); setError(null)
      const { getSupabase } = await import('@/lib/supabase')
      const supabase = getSupabase()

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }

      const pr = await supabase.from('profiles').select('is_admin').eq('id', user.id).single<Profile>()
      if (pr.error || !pr.data?.is_admin) { setIsAdmin(false); setLoading(false); return }
      setIsAdmin(true)

      const resp = await supabase.rpc('admin_stats_overview')
      if (resp.error) { setError(resp.error.message); setLoading(false); return }
      setOv((resp.data?.[0] ?? null) as Overview | null)
      setLoading(false)
    }
    void run()
  }, [router])

  if (loading) return <main className="p-6">불러오는 중…</main>
  if (!isAdmin) return (
    <main className="p-6">
      <h1 className="text-2xl font-bold">관리자</h1>
      <p className="mt-2 text-red-600">접근 권한이 없습니다.</p>
    </main>
  )

  return (
    <main className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">관리자 대시보드</h1>
      {error && <p className="text-red-600">{error}</p>}

      {/* 요약 카드 */}
      <section className="grid md:grid-cols-4 gap-3">
        <div className="rounded border p-4">
          <div className="text-sm text-gray-600">총 유저</div>
          <div className="text-2xl font-semibold">{ov?.total_users ?? '-'}</div>
        </div>
        <div className="rounded border p-4">
          <div className="text-sm text-gray-600">총 회차</div>
          <div className="text-2xl font-semibold">{ov?.total_rounds ?? '-'}</div>
        </div>
        <div className="rounded border p-4">
          <div className="text-sm text-gray-600">제출된 주문</div>
          <div className="text-2xl font-semibold">{ov?.total_orders_submitted ?? '-'}</div>
        </div>
        <div className="rounded border p-4">
          <div className="text-sm text-gray-600">참여율</div>
          <div className="text-2xl font-semibold">{ov ? `${ov.participation_rate}%` : '-'}</div>
        </div>
      </section>

      {/* 네비 카드 */}
      <section className="grid md:grid-cols-3 gap-4">
        <Link href="/admin/rounds" className="rounded border p-5 hover:bg-gray-50 block">
          <div className="text-lg font-semibold">회차 관리</div>
          <div className="text-sm text-gray-600 mt-1">회차 목록/집계/상품/한도</div>
        </Link>
        <Link href="/admin/users" className="rounded border p-5 hover:bg-gray-50 block">
          <div className="text-lg font-semibold">유저 관리</div>
          <div className="text-sm text-gray-600 mt-1">관리자 권한, 기본 정보</div>
        </Link>
        <Link href="/admin/analytics" className="rounded border p-5 hover:bg-gray-50 block">
          <div className="text-lg font-semibold">통계</div>
          <div className="text-sm text-gray-600 mt-1">회차별 참여 현황</div>
        </Link>
      </section>
    </main>
  )
}
