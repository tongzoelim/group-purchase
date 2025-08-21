'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function AuthConfirmPage() {
  const router = useRouter()
  const [msg, setMsg] = useState('인증 확인 중입니다…')

  useEffect(() => {
    const run = async () => {
      // 이메일 매직링크는 해시(#)에 token_hash, type 등이 붙습니다.
      // 예: #access_token=... 또는 #...token_hash=...&type=magiclink
      const hash = window.location.hash // "#...token_hash=...&type=magiclink..."
      const params = new URLSearchParams(hash.replace(/^#/, ''))
      const token_hash = params.get('token_hash')
      const type = (params.get('type') || 'magiclink') as Parameters<typeof supabase.auth.verifyOtp>[0]['type']

      if (token_hash) {
        const { error } = await supabase.auth.verifyOtp({ type, token_hash })
        if (error) {
          setMsg(`인증 실패: ${error.message}`)
          return
        }
      } else {
        // 일부 설정에서는 code 파라미터로 돌아올 수 있음 (OAuth 등)
        const code = new URLSearchParams(window.location.search).get('code')
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession({ code })
          if (error) {
            setMsg(`인증 실패: ${error.message}`)
            return
          }
        }
      }

      setMsg('인증 완료! 이동 중…')
      router.replace('/products')
    }
    run()
  }, [router])

  return (
    <main className="max-w-md mx-auto p-6">
      <h1 className="text-xl font-semibold">{msg}</h1>
      <p className="mt-2 text-sm text-gray-600">창을 닫지 말고 잠시만 기다려주세요.</p>
    </main>
  )
}
