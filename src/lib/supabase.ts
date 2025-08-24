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
 * supabase의 프로퍼티/메서드에 접근하는 순간 클라이언트가 초기화됩니다.
 * (any 사용 없음)
 */
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const client = initClient()
    // any 없이 Reflect.get 사용
    const value = Reflect.get(client as object, prop, receiver)
    return typeof value === 'function' ? value.bind(client) : value
  },
}) as SupabaseClient

/** (옵션) 함수형으로 쓰고 싶은 곳에서 사용 */
export function getSupabase(): SupabaseClient {
  return initClient()
}
