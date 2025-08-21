'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

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
      // 가입: Auth만 생성 (여기서는 profiles에 쓰지 않음)
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) throw error

      // 학번/이름을 임시 저장 → 로그인 후 /complete-profile에서 DB 반영
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('pending_student_id', studentId.trim())
        sessionStorage.setItem('pending_name', name.trim())
      }

      setMsg('회원가입 완료! 이제 로그인 해주세요.')
      // 바로 로그인 페이지로 이동
      router.replace('/login')
    } catch (err: any) {
      setMsg(`오류: ${err?.message || String(err)}`)
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
        />
        <input
          type="password"
          required
          value={password}
          onChange={(e)=>setPassword(e.target.value)}
          placeholder="비밀번호"
          className="w-full border rounded px-3 py-2"
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
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-black text-white rounded py-2"
        >
          {loading ? '처리 중…' : '가입하기'}
        </button>
      </form>
      {msg && <p className="mt-3 text-sm">{msg}</p>}
    </main>
  )
}
