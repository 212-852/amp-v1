"use client"

import { createClient } from "@supabase/supabase-js"

function get_cookie(name: string) {
  const cookie = document.cookie
    .split("; ")
    .find((item) => item.startsWith(`${encodeURIComponent(name)}=`))

  return cookie ? decodeURIComponent(cookie.split("=").slice(1).join("=")) : null
}

function set_cookie(name: string, value: string) {
  document.cookie = [
    `${encodeURIComponent(name)}=${encodeURIComponent(value)}`,
    "path=/",
    "max-age=604800",
    "samesite=lax",
    window.location.protocol === "https:" ? "secure" : "",
  ]
    .filter(Boolean)
    .join("; ")
}

function remove_cookie(name: string) {
  document.cookie = [
    `${encodeURIComponent(name)}=`,
    "path=/",
    "max-age=0",
    "samesite=lax",
    window.location.protocol === "https:" ? "secure" : "",
  ]
    .filter(Boolean)
    .join("; ")
}

export function create_browser_supabase_client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    throw new Error("Supabase browser config is missing")
  }

  return createClient(url, key, {
    auth: {
      detectSessionInUrl: false,
      flowType: "pkce",
      persistSession: true,
      storage: {
        getItem: get_cookie,
        setItem: set_cookie,
        removeItem: remove_cookie,
      },
    },
  })
}
