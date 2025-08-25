'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
export const dynamic = 'force-dynamic'

export default function SignUpPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [studentId, setStudentId] = useState('')
  const [name, setName] = useState('')
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMsg('')
    setLoading(true)
    try {
      // 1) 메타데이터에 학번/이름 넣어서 가입
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { student_id: studentId.trim(), name: name.trim() } },
      })
      if (error) throw error

      // 2) 즉시 세션이 있다면(= 이메일 인증 없이 바로 로그인되는 설정)
      //    RLS를 통과해 profiles에 upsert 시도
      if (data.session && data.user) {
        const { error: upErr } = await supabase
          .from('profiles')
          .upsert(
            {
              id: data.user.id,            // profiles.id = auth.users.id (uuid)
              student_id: studentId.trim(),
              name: name.trim(),
            },
            { onConflict: 'id' }           // id 기준 upsert
          )
        if (upErr) {
          // upsert 실패해도 가입 자체는 완료이므로 메시지만 남기고 진행
          console.error('profiles upsert 실패:', upErr.message)
        }
      }

      // 안내 및 라우팅
      // - 이메일 인증이 필요한 프로젝트라면 확인 후 로그인 가능
      setMsg('회원가입 완료! 이메일을 확인한 뒤 로그인해 주세요.')
      router.replace('/login')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '알 수 없는 오류'
      setMsg(`오류: ${message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">회원가입</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        <input
          type="email"
          required
          value={email}
          onChange={(e)=>setEmail(e.target.value)}
          placeholder="이메일"
          className="w-full border rounded px-3 py-2"
          autoComplete="email"
        />
        <input
          type="password"
          required
          value={password}
          onChange={(e)=>setPassword(e.target.value)}
          placeholder="비밀번호"
          className="w-full border rounded px-3 py-2"
          autoComplete="new-password"
          minLength={6}
        />
        <input
          required
          value={studentId}
          onChange={(e)=>setStudentId(e.target.value)}
          placeholder="학번"
          className="w-full border rounded px-3 py-2"
        />
        <input
          required
          value={name}
          onChange={(e)=>setName(e.target.value)}
          placeholder="이름"
          className="w-full border rounded px-3 py-2"
        />
        <button type="submit" disabled={loading} className="w-full bg-black text-white rounded py-2">
          {loading ? '처리 중…' : '가입하기'}
        </button>
      </form>
      {msg && <p className="mt-3 text-sm">{msg}</p>}
    </main>
  )
}
