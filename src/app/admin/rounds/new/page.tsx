'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { PostgrestError } from '@supabase/supabase-js'

type Profile = { is_admin: boolean }

export default function AdminNewRoundPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  const [title, setTitle] = useState('')
  const [deadline, setDeadline] = useState('') // 'YYYY-MM-DDTHH:mm' (datetime-local)
  const [status, setStatus] = useState<'open'|'closed'>('open')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 관리자 체크
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
      setLoading(false)
    }
    void init()
  }, [router])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) { setError('제목을 입력해주세요.'); return }
    if (!deadline) { setError('마감일시를 선택해주세요.'); return }

    setSubmitting(true)
    setError(null)
    try {
      const { getSupabase } = await import('@/lib/supabase')
      const supabase = getSupabase()

      // datetime-local → ISO (로컬 타임존 기준)
      const iso = new Date(deadline).toISOString()

      const { data, error } = await supabase
        .from('rounds')
        .insert({ title: title.trim(), deadline: iso, status })
        .select('id')
        .single<{ id: string }>()

      if (error) {
        const e = error as PostgrestError
        setError(e.message)
        setSubmitting(false)
        return
      }
      router.replace(`/admin/rounds/${data!.id}`)
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

  return (
    <main className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">회차 등록</h1>
        <Link href="/admin" className="underline text-sm">← 관리자 홈</Link>
      </div>

      <form onSubmit={onSubmit} className="rounded border p-4 space-y-4 max-w-xl">
        <div>
          <label className="block text-sm font-medium">제목</label>
          <input
            className="mt-1 w-full border rounded px-3 py-2"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="예: 9월 간식 공동구매"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">마감일시</label>
          <input
            type="datetime-local"
            className="mt-1 w-full border rounded px-3 py-2"
            value={deadline}
            onChange={e => setDeadline(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium">상태</label>
          <select
            className="mt-1 w-full border rounded px-3 py-2"
            value={status}
            onChange={e => setStatus(e.target.value as 'open'|'closed')}
          >
            <option value="open">open (진행중)</option>
            <option value="closed">closed (마감)</option>
          </select>
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
