'use client'
export const dynamic = 'force-dynamic'
export default function EnvCheck() {
  // 빌드 시점에 문자열로 치환되므로 클라이언트에서도 접근 가능(Next PUBLIC prefix)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  return (
    <main style={{padding:20}}>
      <h1>Env Check</h1>
      <p>URL: {url ? url : '(undefined)'}</p>
      <p>ANON KEY: {key ? key.slice(0,6) + '…' : '(undefined)'}</p>
    </main>
  )
}
