import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { resolveAuthContext } from "@/core/auth/context"
import {
  resolveAuthUserProfile,
  resolveIdentity,
  sendIdentityDebug,
} from "@/core/auth/identity"
import { linkCurrentVisitorToIdentity } from "@/core/auth/link"
import { resolveAuthRoute } from "@/core/auth/route"
import { resolveSession } from "@/core/auth/session"
import { resolveEntranceContext } from "@/core/entrance/context"

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"
const GOOGLE_STATE_COOKIE = "amp_google_oauth_state"
const GOOGLE_STATE_MAX_AGE = 10 * 60

type GoogleUserInfo = {
  sub?: string
  email?: string
  name?: string
  picture?: string
}

function appBaseUrl(request: Request) {
  const requestUrl = new URL(request.url)

  if (requestUrl.hostname === "localhost" || requestUrl.hostname === "127.0.0.1") {
    return requestUrl.origin
  }

  return (process.env.NEXT_PUBLIC_APP_URL ?? requestUrl.origin).replace(/\/$/, "")
}

function googleRedirectUri(request: Request) {
  return `${appBaseUrl(request)}/api/auth/google/callback`
}

function redirectHome(request: Request) {
  return NextResponse.redirect(new URL("/", appBaseUrl(request)))
}

function redirectAuthError(request: Request, reason: string) {
  return NextResponse.redirect(new URL(`/?auth_error=${reason}`, appBaseUrl(request)))
}

function createOAuthState() {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)

  return Buffer.from(bytes).toString("base64url")
}

function stateCookieOptions() {
  return {
    httpOnly: true,
    maxAge: GOOGLE_STATE_MAX_AGE,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  }
}

async function sendGoogleFailure(input: {
  reason: string
  visitor_uuid: string | null
  user_uuid: string | null
  provider_user_id?: string | null
  email?: string | null
  error_message: string
  error_code?: string | null
  source_channel: string | null
}) {
  await sendIdentityDebug("identity_link_failed", {
    provider: "google",
    reason: input.reason,
    visitor_uuid: input.visitor_uuid,
    user_uuid: input.user_uuid,
    provider_user_id: input.provider_user_id ?? null,
    email: input.email ?? null,
    error_message: input.error_message,
    error_code: input.error_code ?? null,
    source_channel: input.source_channel,
  })
}

async function exchangeGoogleCode(request: NextRequest, code: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth env is missing")
  }

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: googleRedirectUri(request),
    }),
    cache: "no-store",
  })

  if (!response.ok) {
    const error = await response.text().catch(() => "")

    throw new Error(error || `Google token exchange failed: ${response.status}`)
  }

  const token = (await response.json()) as { access_token?: string }

  if (!token.access_token) {
    throw new Error("Google token response did not include access_token")
  }

  return token.access_token
}

async function fetchGoogleUserInfo(accessToken: string) {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  })

  if (!response.ok) {
    const error = await response.text().catch(() => "")

    throw new Error(error || `Google userinfo failed: ${response.status}`)
  }

  const userInfo = (await response.json()) as GoogleUserInfo

  if (!userInfo.sub) {
    throw new Error("Google userinfo did not include sub")
  }

  return userInfo
}

export async function startDirectGoogleOAuth(request: NextRequest) {
  const context = await resolveAuthContext()
  const session = await resolveSession(context)
  const clientId = process.env.GOOGLE_CLIENT_ID

  if (!clientId) {
    await sendGoogleFailure({
      reason: "missing_google_client_id",
      visitor_uuid: session.visitor_uuid,
      user_uuid: session.user_uuid,
      error_message: "GOOGLE_CLIENT_ID is missing",
      source_channel: context.source_channel,
    })

    return redirectAuthError(request, "google_config")
  }

  const state = createOAuthState()
  const response = NextResponse.redirect(
    new URL(
      `${GOOGLE_AUTH_URL}?${new URLSearchParams({
        client_id: clientId,
        redirect_uri: googleRedirectUri(request),
        response_type: "code",
        scope: "openid email profile",
        state,
        access_type: "offline",
        prompt: "consent",
      })}`,
    ),
  )

  response.cookies.set(GOOGLE_STATE_COOKIE, state, stateCookieOptions())

  await sendIdentityDebug("identity_link_started", {
    provider: "google",
    visitor_uuid: session.visitor_uuid,
    user_uuid: session.user_uuid,
    source_channel: context.source_channel,
  })
  await sendIdentityDebug("google_oauth_start", {
    provider: "google",
    visitor_uuid: session.visitor_uuid,
    user_uuid: session.user_uuid,
    source_channel: context.source_channel,
    redirect_uri: googleRedirectUri(request),
  })

  return response
}

export async function completeDirectGoogleOAuthCallback(request: NextRequest) {
  const context = await resolveAuthContext()
  const session = await resolveSession(context)
  const requestUrl = request.nextUrl
  const code = requestUrl.searchParams.get("code")
  const state = requestUrl.searchParams.get("state")
  const error = requestUrl.searchParams.get("error")
  const storedState = request.cookies.get(GOOGLE_STATE_COOKIE)?.value ?? null
  const response = redirectHome(request)

  response.cookies.delete(GOOGLE_STATE_COOKIE)

  await sendIdentityDebug("google_oauth_callback_received", {
    provider: "google",
    visitor_uuid: session.visitor_uuid,
    user_uuid: session.user_uuid,
    code_exists: Boolean(code),
    state_exists: Boolean(state),
    error,
    source_channel: context.source_channel,
  })

  if (error) {
    await sendGoogleFailure({
      reason: "google_oauth_error",
      visitor_uuid: session.visitor_uuid,
      user_uuid: session.user_uuid,
      error_message: error,
      source_channel: context.source_channel,
    })

    return redirectAuthError(request, "google")
  }

  if (!code) {
    await sendGoogleFailure({
      reason: "missing_code",
      visitor_uuid: session.visitor_uuid,
      user_uuid: session.user_uuid,
      error_message: "Google callback did not include code",
      source_channel: context.source_channel,
    })

    return redirectAuthError(request, "missing_code")
  }

  if (!state || !storedState || state !== storedState) {
    await sendIdentityDebug("google_oauth_state_failed", {
      provider: "google",
      visitor_uuid: session.visitor_uuid,
      user_uuid: session.user_uuid,
      state_exists: Boolean(state),
      stored_state_exists: Boolean(storedState),
      source_channel: context.source_channel,
    })
    await sendGoogleFailure({
      reason: "state_mismatch",
      visitor_uuid: session.visitor_uuid,
      user_uuid: session.user_uuid,
      error_message: "Google OAuth state mismatch",
      source_channel: context.source_channel,
    })

    return redirectAuthError(request, "google_state")
  }

  let userInfo: GoogleUserInfo

  try {
    const accessToken = await exchangeGoogleCode(request, code)

    await sendIdentityDebug("google_token_exchange_success", {
      provider: "google",
      visitor_uuid: session.visitor_uuid,
      user_uuid: session.user_uuid,
      source_channel: context.source_channel,
    })

    userInfo = await fetchGoogleUserInfo(accessToken)
  } catch (tokenError) {
    const message = tokenError instanceof Error ? tokenError.message : String(tokenError)

    await sendIdentityDebug("google_token_exchange_failed", {
      provider: "google",
      visitor_uuid: session.visitor_uuid,
      user_uuid: session.user_uuid,
      error_message: message,
      source_channel: context.source_channel,
    })
    await sendGoogleFailure({
      reason: "token_exchange_failed",
      visitor_uuid: session.visitor_uuid,
      user_uuid: session.user_uuid,
      error_message: message,
      source_channel: context.source_channel,
    })

    return redirectAuthError(request, "google")
  }

  try {
    const result = await linkCurrentVisitorToIdentity({
      provider: "google",
      provider_user_id: userInfo.sub,
      email: userInfo.email ?? null,
      display_name: userInfo.name ?? null,
      image_url: userInfo.picture ?? null,
    })
    const linkedProfile = await resolveAuthUserProfile(result.user_uuid)
    const identity = await resolveIdentity(context, result.session)
    const entrance = await resolveEntranceContext()
    const route = resolveAuthRoute(context, entrance, result.session, identity)

    await sendIdentityDebug("identity_link_success", {
      provider: "google",
      visitor_uuid: result.visitor_uuid,
      user_uuid: result.user_uuid,
      identity_uuid: result.identity_uuid,
      email: result.email,
      display_name: result.display_name,
      source_channel: result.source_channel,
    })
    await sendIdentityDebug("session_after_identity_link", {
      visitor_uuid: result.visitor_uuid,
      user_uuid: result.user_uuid,
      role: linkedProfile.role,
      tier: linkedProfile.tier,
      display_name: linkedProfile.display_name,
      provider: "google",
      provider_user_id: userInfo.sub,
      email: result.email,
      source_channel: result.source_channel,
    })

    void route

    return response
  } catch (linkError) {
    const message = linkError instanceof Error ? linkError.message : String(linkError)

    await sendGoogleFailure({
      reason: "link_failed",
      visitor_uuid: session.visitor_uuid,
      user_uuid: session.user_uuid,
      provider_user_id: userInfo.sub ?? null,
      email: userInfo.email ?? null,
      error_message: message,
      source_channel: context.source_channel,
    })

    return redirectAuthError(request, "link_failed")
  }
}
