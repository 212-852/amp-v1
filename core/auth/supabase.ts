import { createClient } from "@supabase/supabase-js"

export function create_auth_supabase_client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    throw new Error("Supabase auth client config is missing")
  }

  return createClient(url, key)
}
