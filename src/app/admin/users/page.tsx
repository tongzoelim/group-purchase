'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { PostgrestError } from '@supabase/supabase-js'

type Profile = { is_admin: boolean }
type UserRow = {
  id: string
  email: string | null
  name: string | null
  student_id: string | null
  is_admin: boolean
  created_at: string
}

export default function AdminUsersPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [rows, setRows] = useState<UserRow[]>([])
  const [q, setQ] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null) // user_id

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return rows
    return rows.filter(r =>
      (r.name ?? '').toLowerCase().includes(s) ||
      (r.email ?? '').toLowerCase().includes(s) ||
      (r.student_id ?? '').toLowerCase().includes(s)
    )
  }, [rows, q])

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

      const resp = await supabase.rpc('admin_users_list')
      if (resp.error) { const e = resp.error as PostgrestError; setError(e.message); setLoading(false); return }
      setRows((resp.data ?? []) as unknown as UserRow[])
      setLoading(false)
    }
    void run()
  }, [router])

  const toggleAdmin = async (id: string, next: boolean) => {
    setSaving(id); setError(null)
    try {
      const { getSupabase } = await import('@/lib/supabase')
      const supabase = getSupabase()
      const { error } = await supabase.rpc('admin_set_is_admin', { p_user: id, p_is_admin: next })
      if (error) throw error
      setRows(prev => prev.map(u => u.id === id ? { ...u, is_admin: next } : u))
    } catch (e) {
      setError(e instanceof Error ? e.message : '알 수 없는 오류')
    } finally {
      setSaving(null)
    }
  }

  if (loading) return <main className="p-6">불러오는 중…</main>
  if (!isAdmin) return (
    <main className="p-6">
      <h1 className="text-2xl font-bold">유저 관리</h1>
      <p className="mt-2 text-red-600">접근 권한이 없습니다.</p>
    </main>
  )

  return (
    <main className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">유저 관리</h1>
        <Link href="/admin" className="underline text-sm">← 관리자 홈</Link>
      </div>

      {error && <p className="text-red-600">{error}</p>}

      <div className="flex gap-2">
        <input
          value={q}
          onChange={(e)=>setQ(e.target.value)}
          placeholder="이름/이메일/학번 검색"
          className="border rounded px-3 py-2 w-full max-w-sm"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[820px] w-full text-sm text-white-900 border">
          <thead className="bg-black text-white">
            <tr className="border-b">
              <th className="text-left p-2">이름</th>
              <th className="text-left p-2">이메일</th>
              <th className="text-left p-2">학번</th>
              <th className="text-left p-2">관리자</th>
              <th className="text-left p-2">가입일</th>
              <th className="text-left p-2">작업</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(u => (
              <tr key={u.id} className="border-b">
                <td className="p-2">{u.name ?? '-'}</td>
                <td className="p-2">{u.email ?? '-'}</td>
                <td className="p-2">{u.student_id ?? '-'}</td>
                <td className="p-2">{u.is_admin ? '예' : '아니오'}</td>
                <td className="p-2">{new Date(u.created_at).toLocaleDateString()}</td>
                <td className="p-2">
                  <button
                    disabled={saving === u.id}
                    onClick={() => toggleAdmin(u.id, !u.is_admin)}
                    className={`rounded px-3 py-1 ${saving === u.id ? 'bg-gray-300' : 'border'}`}
                  >
                    {u.is_admin ? '관리자 해제' : '관리자로 지정'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  )
}
