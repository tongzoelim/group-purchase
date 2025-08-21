// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,      // 3-5에서 넣은 값
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!  // 3-5에서 넣은 값
)
