import { createClient, type SupabaseClient } from "@supabase/supabase-js"

let auth_client_instance: SupabaseClient | null = null

export function create_auth_supabase_client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    throw new Error("Supabase auth client config is missing")
  }

  return createClient(url, key)
}

export function get_shared_auth_supabase_client() {
  auth_client_instance ??= create_auth_supabase_client()

  return auth_client_instance
}

export function create_service_role_supabase_client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error("Supabase service role client config is missing")
  }

  return createClient(url, key)
}
