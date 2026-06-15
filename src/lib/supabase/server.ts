import { createClient, type AuthTokenResponsePassword } from "@supabase/supabase-js"
import type { ReadonlyRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies"
import type { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies"
import type { NextResponse } from "next/server"

type CookieStore = ReadonlyRequestCookies

function cookie_options(): Partial<ResponseCookie> {
  return {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  }
}

export function create_server_supabase_client(
  cookieStore: CookieStore,
  response: NextResponse,
) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    throw new Error("Supabase server config is missing")
  }

  return createClient(url, key, {
    auth: {
      detectSessionInUrl: false,
      flowType: "pkce",
      persistSession: true,
      storage: {
        getItem(name) {
          return cookieStore.get(name)?.value ?? null
        },
        setItem(name, value) {
          response.cookies.set(name, value, cookie_options())
        },
        removeItem(name) {
          response.cookies.delete(name)
        },
      },
    },
  })
}

export function set_amp_auth_cookies(
  response: NextResponse,
  session: AuthTokenResponsePassword["data"]["session"],
) {
  if (!session?.access_token) {
    return
  }

  response.cookies.set(
    "sb-access-token",
    session.access_token,
    cookie_options(),
  )

  if (session.refresh_token) {
    response.cookies.set(
      "sb-refresh-token",
      session.refresh_token,
      cookie_options(),
    )
  }
}
