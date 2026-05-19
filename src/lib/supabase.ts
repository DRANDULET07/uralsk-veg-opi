import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

function normalizeSupabaseUrl(url: string): string {
  return url.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '')
}

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Не указаны переменные VITE_SUPABASE_URL или VITE_SUPABASE_ANON_KEY',
  )
}

export const supabase = createClient(normalizeSupabaseUrl(supabaseUrl), supabaseAnonKey)
