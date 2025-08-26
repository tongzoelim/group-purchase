'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { PostgrestError } from '@supabase/supabase-js'

type Profile = { is_admin: boolean }
type Overview = { total_users: number; total_rounds: number; total_orders_submitted: number; distinct_submitters: number; participation_rate: number }
type RoundRow = { round_id: string; title: string; users_submitted: number; orders_submitted: number; latest_submitted_at: string | null }

export default function AdminAnalyticsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [ov, setOv] = useState<Overview | null>(null)
  const [rows, setRows] = useState<RoundRow[]>([])
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

      const o = await supabase.rpc('admin_stats_overview')
      if (o.error) { const e = o.error as PostgrestError; setError(e.message); setLoading(false); return }
      setOv((o.data?.[0] ?? null) as Overview | null)

      const r = await supabase.rpc('admin_round_participation')
      if (r.error) { const e = r.error as PostgrestError; setError(e.message); setLoading(false); return }
      setRows((r.data ?? []) as unknown as RoundRow[])

      setLoading(false)
    }
    void run()
  }, [router])

  if (loading) return <main className="p-6">불러오는 중…</main>
  if (!isAdmin) return (
    <main className="p-6">
      <h1 className="text-2xl font-bold">통계</h1>
      <p className="mt-2 text-red-600">접근 권한이 없습니다.</p>
    </main>
  )

  return (
    <main className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">통계</h1>
        <Link href="/admin" className="underline text-sm">← 관리자 홈</Link>
      </div>

      {/* 요약 */}
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

      {/* 회차별 참여 표 */}
      <section className="rounded border p-4">
        <h2 className="font-semibold mb-3">회차별 참여 현황</h2>
        {rows.length === 0 ? (
          <p className="text-sm text-gray-600">데이터가 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[760px] w-full text-sm text-gray-900 border">
              <thead className="bg-black text-white">
                <tr className="border-b">
                  <th className="text-left p-2">회차</th>
                  <th className="text-right p-2">주문 제출 수</th>
                  <th className="text-right p-2">제출자 수</th>
                  <th className="text-left p-2">최근 제출 시각</th>
                  <th className="text-left p-2">이동</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.round_id} className="border-b">
                    <td className="p-2">{r.title}</td>
                    <td className="p-2 text-right">{r.orders_submitted}</td>
                    <td className="p-2 text-right">{r.users_submitted}</td>
                    <td className="p-2">{r.latest_submitted_at ? new Date(r.latest_submitted_at).toLocaleString() : '-'}</td>
                    <td className="p-2">
                      <Link href={`/admin/rounds/${r.round_id}`} className="underline text-sm">집계</Link>
                    </td>
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
