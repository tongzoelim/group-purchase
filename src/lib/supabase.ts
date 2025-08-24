// src/lib/supabase.ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let _client: SupabaseClient | null = null

function initClient(): SupabaseClient {
  if (_client) return _client
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    // 빌드/프리렌더에서 바로 터지지 않도록, 실제 접근 시점에만 에러
    throw new Error('Supabase env vars missing: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY')
  }
  _client = createClient(url, key)
  return _client
}

/**
 * 기존 사용법 유지:
 *   import { supabase } from '@/lib/supabase'
 * supabase.xxx 접근 시점에 클라이언트를 초기화합니다.
 */
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const client = initClient()
    // @ts-expect-error - 동적 포워딩
    const value = client[prop]
    return typeof value === 'function' ? value.bind(client) : Reflect.get(client as any, prop, receiver)
  },
}) as SupabaseClient

/**
 * (옵션) 함수형으로 쓰고 싶은 곳을 위한 헬퍼
 *   const supabase = getSupabase()
 */
export function getSupabase(): SupabaseClient {
  return initClient()
}
