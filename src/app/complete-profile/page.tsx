'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function CompleteProfilePage() {
  const router = useRouter()
  const [studentId, setStudentId] = useState('')
  const [name, setName] = useState('')
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)

  // 1) 세션 체크 + 임시 저장된 값 불러오기
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }
      // 임시 저장값(prefill)
      if (typeof window !== 'undefined') {
        const sid = sessionStorage.getItem('pending_student_id') || ''
        const nm  = sessionStorage.getItem('pending_name') || ''
        setStudentId(sid)
        setName(nm)
      }
      setReady(true)
    }
    init()
  }, [router])

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setMsg('')
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('로그인이 필요합니다.')

      // 2) profiles 업데이트 (세션이 있으므로 RLS 통과)
      const { error } = await supabase
        .from('profiles')
        .update({ student_id: studentId.trim(), name: name.trim() })
        .eq('id', user.id)

      if (error) {
        // 학번 UNIQUE 제약 충돌 코드: 23505
        if ((error as any).code === '23505') {
          throw new Error('이미 사용 중인 학번입니다.')
        }
        throw error
      }

      // 저장 성공 → 임시값 제거
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('pending_student_id')
        sessionStorage.removeItem('pending_name')
      }

      setMsg('프로필 저장 완료!')
      // 원하면 바로 상품 페이지로
      router.replace('/products')
    } catch (err: any) {
      setMsg(`오류: ${err?.message || String(err)}`)
    } finally {
      setLoading(false)
    }
  }

  if (!ready) return <main className="p-6">확인 중…</main>

  return (
    <main className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">추가 정보 입력</h1>
      <p className="text-sm text-gray-600 mb-4">
        학번과 이름을 저장하면 공동구매 신청에 사용됩니다.
      </p>
      <form onSubmit={onSave} className="space-y-3">
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
          {loading ? '저장 중…' : '저장하기'}
        </button>
      </form>
      {msg && <p className="mt-3 text-sm">{msg}</p>}
    </main>
  )
}
