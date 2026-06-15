import { cookies } from "next/headers"
import { NextResponse } from "next/server"

import { linkCurrentVisitorToIdentity } from "@/core/auth/link"
import {
  normalizeGoogleIdentityInput,
  type SupabaseAuthUser,
} from "@/core/auth/identity"
import { getRestConfig } from "@/core/db/rest"
import { sendAuthDebug } from "@/core/debug"
import { normalize_locale } from "@/src/lib/locale"

const google_code_verifier_cookie = "amp_google_code_verifier"
const google_state_cookie = "amp_google_oauth_state"
const google_locale_cookie = "amp_google_locale"
const auth_cookie_max_age = 60 * 60 * 24 * 7
const oauth_cookie_max_age = 60 * 10

type GoogleTokenResponse = {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  token_type?: string
}

function base64url(bytes: ArrayBuffer | Uint8Array) {
  const byteArray = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)

  return Buffer.from(byteArray)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
}

function randomBase64Url(byteLength: number) {
  return base64url(crypto.getRandomValues(new Uint8Array(byteLength)))
}

async function codeChallenge(verifier: string) {
  const bytes = new TextEncoder().encode(verifier)
  const digest = await crypto.subtle.digest("SHA-256", bytes)

  return base64url(digest)
}

function appBaseUrl(request: Request) {
  const requestUrl = new URL(request.url)

  if (requestUrl.hostname === "localhost" || requestUrl.hostname === "127.0.0.1") {
    return requestUrl.origin
  }

  return (process.env.NEXT_PUBLIC_APP_URL ?? requestUrl.origin).replace(/\/$/, "")
}

function callbackUrl(request: Request) {
  return `${appBaseUrl(request)}/auth/callback`
}

function googleAuthorizeUrl(config: NonNullable<ReturnType<typeof getRestConfig>>) {
  return `${config.url.replace(/\/$/, "")}/auth/v1/authorize`
}

function googleTokenUrl(config: NonNullable<ReturnType<typeof getRestConfig>>) {
  return `${config.url.replace(/\/$/, "")}/auth/v1/token?grant_type=pkce`
}

function googleUserUrl(config: NonNullable<ReturnType<typeof getRestConfig>>) {
  return `${config.url.replace(/\/$/, "")}/auth/v1/user`
}

function authCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    maxAge,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  }
}

async function exchangeGoogleCode(code: string, verifier: string) {
  const config = getRestConfig()

  if (!config) {
    throw new Error("Supabase config is missing")
  }

  const response = await fetch(googleTokenUrl(config), {
    method: "POST",
    headers: {
      apikey: config.key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      auth_code: code,
      code_verifier: verifier,
    }),
    cache: "no-store",
  })

  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as {
      error?: string
      error_description?: string
      msg?: string
    }

    throw new Error(
      `Google code exchange failed: ${
        error.error_description ?? error.msg ?? error.error ?? response.statusText
      }`,
    )
  }

  return (await response.json()) as GoogleTokenResponse
}

async function getGoogleAuthUser(accessToken: string) {
  const config = getRestConfig()

  if (!config) {
    throw new Error("Supabase config is missing")
  }

  const response = await fetch(googleUserUrl(config), {
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  })

  if (!response.ok) {
    throw new Error(`Failed to load Google auth user: ${response.statusText}`)
  }

  return (await response.json()) as SupabaseAuthUser
}

function redirectHome(request: Request) {
  return NextResponse.redirect(new URL("/", appBaseUrl(request)))
}

export async function startGoogleOAuth(request: Request) {
  const config = getRestConfig()

  if (!config) {
    await sendAuthDebug("google_callback_failed", {
      reason: "missing_supabase_config",
    })

    return redirectHome(request)
  }

  const verifier = randomBase64Url(64)
  const state = randomBase64Url(32)
  const challenge = await codeChallenge(verifier)
  const requestUrl = new URL(request.url)
  const locale = normalize_locale(requestUrl.searchParams.get("locale"))
  const authorizeUrl = new URL(googleAuthorizeUrl(config))

  authorizeUrl.searchParams.set("provider", "google")
  authorizeUrl.searchParams.set("redirect_to", callbackUrl(request))
  authorizeUrl.searchParams.set("code_challenge", challenge)
  authorizeUrl.searchParams.set("code_challenge_method", "s256")
  authorizeUrl.searchParams.set("state", state)

  const response = NextResponse.redirect(authorizeUrl)

  response.cookies.set(
    google_code_verifier_cookie,
    verifier,
    authCookieOptions(oauth_cookie_max_age),
  )
  response.cookies.set(
    google_state_cookie,
    state,
    authCookieOptions(oauth_cookie_max_age),
  )
  response.cookies.set(
    google_locale_cookie,
    locale,
    authCookieOptions(oauth_cookie_max_age),
  )

  return response
}

export async function completeGoogleOAuthCallback(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")
  const state = requestUrl.searchParams.get("state")
  const cookieStore = await cookies()
  const verifier = cookieStore.get(google_code_verifier_cookie)?.value ?? null
  const expectedState = cookieStore.get(google_state_cookie)?.value ?? null
  const locale = cookieStore.get(google_locale_cookie)?.value ?? null
  const response = redirectHome(request)

  response.cookies.delete(google_code_verifier_cookie)
  response.cookies.delete(google_state_cookie)
  response.cookies.delete(google_locale_cookie)

  try {
    if (!code || !verifier || !state || state !== expectedState) {
      throw new Error("Google callback is missing valid OAuth state")
    }

    const token = await exchangeGoogleCode(code, verifier)

    if (!token.access_token) {
      throw new Error("Google callback did not return access_token")
    }

    const user = await getGoogleAuthUser(token.access_token)
    const identityInput = normalizeGoogleIdentityInput(user, locale)

    await linkCurrentVisitorToIdentity(identityInput)

    response.cookies.set(
      "sb-access-token",
      token.access_token,
      authCookieOptions(token.expires_in ?? auth_cookie_max_age),
    )

    if (token.refresh_token) {
      response.cookies.set(
        "sb-refresh-token",
        token.refresh_token,
        authCookieOptions(auth_cookie_max_age),
      )
    }

    return response
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    if (message.includes("visitor") || message.includes("Visitor")) {
      await sendAuthDebug("visitor_missing_on_google_callback", {
        error_message: message,
      })
    }

    await sendAuthDebug("google_callback_failed", {
      error_message: message,
    })

    return response
  }
}
