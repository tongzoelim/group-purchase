'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function MePage() {
  const [profile, setProfile] = useState<any>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const { data: { user }, error: uerr } = await supabase.auth.getUser()
      if (uerr || !user) { setErr('로그인이 필요합니다.'); return }
      const { data, error } = await supabase
        .from('profiles')
        .select('name, student_id')
        .eq('id', user.id)
        .single()
      if (error) setErr(error.message)
      else setProfile(data)
    }
    load()
  }, [])

  if (err) return <main className="p-6 text-red-600">{err}</main>
  if (!profile) return <main className="p-6">불러오는 중…</main>

  return (
    <main className="p-6">
      <h1 className="text-xl font-semibold mb-2">내 프로필</h1>
      <div>이름: {profile.name}</div>
      <div>학번: {profile.student_id}</div>
    </main>
  )
}
