'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type Profile = { student_id: string | null; name: string | null }

export default function MePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }
      const { data, error } = await supabase
        .from('profiles')
        .select('student_id, name')
        .eq('id', user.id)
        .single()
      if (error) setErr(error.message)
      else setProfile(data)
    }
    load()
  }, [router])

  if (err) return <main className="text-red-600 p-6">{err}</main>
  if (!profile) return <main className="p-6">불러오는 중…</main>

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-4">내 프로필</h1>
      <div>이름: {profile.name ?? '-'}</div>
      <div>학번: {profile.student_id ?? '-'}</div>
    </main>
  )
}
