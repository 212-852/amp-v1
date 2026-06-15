import { cookies } from "next/headers"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { resolveAuthContext } from "@/core/auth/context"
import {
  normalizeGoogleIdentityInput,
  resolveIdentity,
  sendIdentityDebug,
} from "@/core/auth/identity"
import { linkCurrentVisitorToIdentity } from "@/core/auth/link"
import { resolveAuthRoute } from "@/core/auth/route"
import { resolveSession } from "@/core/auth/session"
import { resolveEntranceContext } from "@/core/entrance/context"
import {
  create_server_supabase_client,
  set_amp_auth_cookies,
} from "@/src/lib/supabase/server"

function appBaseUrl(request: Request) {
  const requestUrl = new URL(request.url)

  if (requestUrl.hostname === "localhost" || requestUrl.hostname === "127.0.0.1") {
    return requestUrl.origin
  }

  return (process.env.NEXT_PUBLIC_APP_URL ?? requestUrl.origin).replace(/\/$/, "")
}

function redirectHome(request: Request) {
  return NextResponse.redirect(new URL("/", appBaseUrl(request)))
}

function redirectGoogleError(request: Request) {
  return NextResponse.redirect(new URL("/?auth_error=google", appBaseUrl(request)))
}

function redirectAuthError(request: Request, reason: string) {
  return NextResponse.redirect(new URL(`/?auth_error=${reason}`, appBaseUrl(request)))
}

async function resolveFailureContext() {
  try {
    const context = await resolveAuthContext()
    const session = await resolveSession(context)

    return {
      visitor_uuid: session.visitor_uuid,
      user_uuid: session.user_uuid,
      source_channel: context.source_channel,
    }
  } catch {
    return {
      visitor_uuid: null,
      user_uuid: null,
      source_channel: null,
    }
  }
}

async function sendGoogleCallbackFailure(input: {
  reason: string
  visitor_uuid: string | null
  user_uuid: string | null
  auth_user_id?: string | null
  email?: string | null
  error_message: string
  error_code?: string | null
  error_description?: string | null
  source_channel: string | null
}) {
  await sendIdentityDebug("identity_link_failed", {
    provider: "google",
    reason: input.reason,
    visitor_uuid: input.visitor_uuid,
    user_uuid: input.user_uuid,
    auth_user_id: input.auth_user_id ?? null,
    email: input.email ?? null,
    error_message: input.error_message,
    error_code: input.error_code ?? null,
    error_description: input.error_description ?? null,
    source_channel: input.source_channel,
  })
}

export async function completeGoogleOAuthCallback(request: NextRequest) {
  try {
    return await completeGoogleOAuthCallbackCore(request)
  } catch (callbackError) {
    const message =
      callbackError instanceof Error ? callbackError.message : String(callbackError)
    const failureContext = await resolveFailureContext()

    await sendGoogleCallbackFailure({
      visitor_uuid: failureContext.visitor_uuid,
      user_uuid: failureContext.user_uuid,
      reason: "unexpected_exception",
      auth_user_id: null,
      email: null,
      error_message: message,
      error_code: null,
      error_description: null,
      source_channel: failureContext.source_channel,
    })

    return redirectAuthError(request, "unexpected_exception")
  }
}

async function completeGoogleOAuthCallbackCore(request: NextRequest) {
  const requestUrl = request.nextUrl
  const code = requestUrl.searchParams.get("code")
  const error = requestUrl.searchParams.get("error")
  const error_code = requestUrl.searchParams.get("error_code")
  const error_description = requestUrl.searchParams.get("error_description")

  await sendIdentityDebug("oauth_callback_enter", {
    provider: "google",
    code_exists: Boolean(code),
    error,
    error_code,
    error_description,
  })
  await sendIdentityDebug("auth_callback_received", {
    provider: "google",
    code_exists: Boolean(code),
    error,
    error_code,
    error_description,
  })

  const failureContext = await resolveFailureContext()

  if (error) {
    await sendGoogleCallbackFailure({
      visitor_uuid: failureContext.visitor_uuid,
      user_uuid: failureContext.user_uuid,
      reason: "oauth_error_before_exchange",
      error_message: error,
      error_code,
      error_description,
      source_channel: failureContext.source_channel,
    })

    return redirectAuthError(request, "oauth_error")
  }

  if (!code) {
    await sendIdentityDebug("oauth_callback_code_missing", {
      provider: "google",
      visitor_uuid: failureContext.visitor_uuid,
      user_uuid: failureContext.user_uuid,
      source_channel: failureContext.source_channel,
    })
    await sendGoogleCallbackFailure({
      visitor_uuid: failureContext.visitor_uuid,
      user_uuid: failureContext.user_uuid,
      reason: "missing_code",
      error_message: "Google callback did not include code",
      error_code: null,
      error_description: null,
      source_channel: failureContext.source_channel,
    })

    return NextResponse.redirect(new URL("/?auth_error=missing_code", appBaseUrl(request)))
  }

  await sendIdentityDebug("oauth_callback_code_found", {
    provider: "google",
    visitor_uuid: failureContext.visitor_uuid,
    user_uuid: failureContext.user_uuid,
    source_channel: failureContext.source_channel,
  })

  const response = redirectHome(request)
  const cookieStore = await cookies()
  const supabase = create_server_supabase_client(cookieStore, response)
  const exchangeResult = await supabase.auth
    .exchangeCodeForSession(code)
    .catch((exchangeError: unknown) => {
      const message =
        exchangeError instanceof Error ? exchangeError.message : String(exchangeError)

      return {
        data: { session: null },
        error: { message },
      }
    })
  const { data, error: exchangeError } = exchangeResult

  if (exchangeError || !data.session?.user) {
    const message = exchangeError?.message ?? "Google session exchange failed"

    await sendIdentityDebug("oauth_exchange_failed", {
      provider: "google",
      visitor_uuid: failureContext.visitor_uuid,
      user_uuid: failureContext.user_uuid,
      error: message,
      source_channel: failureContext.source_channel,
    })
    await sendIdentityDebug("google_code_exchange_failed", {
      provider: "google",
      visitor_uuid: failureContext.visitor_uuid,
      user_uuid: failureContext.user_uuid,
      error: message,
      source_channel: failureContext.source_channel,
    })
    await sendGoogleCallbackFailure({
      visitor_uuid: failureContext.visitor_uuid,
      user_uuid: failureContext.user_uuid,
      reason: data.session?.user ? "oauth_exchange_failed" : "auth_user_missing",
      auth_user_id: data.session?.user?.id ?? null,
      email: data.session?.user?.email ?? null,
      error_message: message,
      error_code: null,
      error_description: null,
      source_channel: failureContext.source_channel,
    })

    return redirectGoogleError(request)
  }

  await sendIdentityDebug("oauth_exchange_success", {
    provider: "google",
    visitor_uuid: failureContext.visitor_uuid,
    user_uuid: failureContext.user_uuid,
    source_channel: failureContext.source_channel,
  })
  await sendIdentityDebug("google_code_exchange_success", {
    provider: "google",
    visitor_uuid: failureContext.visitor_uuid,
    user_uuid: failureContext.user_uuid,
    source_channel: failureContext.source_channel,
  })

  let identityInput: ReturnType<typeof normalizeGoogleIdentityInput>

  try {
    identityInput = normalizeGoogleIdentityInput(data.session.user)
  } catch (normalizeError) {
    const message =
      normalizeError instanceof Error ? normalizeError.message : String(normalizeError)

    await sendGoogleCallbackFailure({
      visitor_uuid: failureContext.visitor_uuid,
      user_uuid: failureContext.user_uuid,
      reason: "identity_normalize_failed",
      auth_user_id: data.session.user.id ?? null,
      email: data.session.user.email ?? null,
      error_message: message,
      error_code: null,
      error_description: null,
      source_channel: failureContext.source_channel,
    })

    return redirectAuthError(request, "link_failed")
  }

  try {
    const result = await linkCurrentVisitorToIdentity(identityInput)
    const context = await resolveAuthContext()
    const entrance = await resolveEntranceContext()
    const identity = await resolveIdentity(context, result.session)
    const route = resolveAuthRoute(context, entrance, result.session, identity)

    set_amp_auth_cookies(response, data.session)

    await sendIdentityDebug("identity_link_success", {
      provider: "google",
      visitor_uuid: result.visitor_uuid,
      user_uuid: result.user_uuid,
      identity_uuid: result.identity_uuid,
      email: result.email,
      display_name: result.display_name,
      source_channel: result.source_channel,
    })

    void route

    return response
  } catch (callbackError) {
    const message =
      callbackError instanceof Error ? callbackError.message : String(callbackError)
    const reason =
      message.includes("visitor") || message.includes("Visitor")
        ? "visitor_missing"
        : "link_failed"
    const payload = {
      provider: "google",
      reason: "link_failed",
      visitor_uuid: failureContext.visitor_uuid,
      user_uuid: failureContext.user_uuid,
      auth_user_id: data.session.user.id ?? null,
      email: data.session.user.email ?? identityInput.email ?? null,
      error_message: message,
      error_code: null,
      source_channel: failureContext.source_channel,
    }

    if (reason === "visitor_missing") {
      await sendGoogleCallbackFailure({
        visitor_uuid: failureContext.visitor_uuid,
        user_uuid: failureContext.user_uuid,
        reason,
        auth_user_id: data.session.user.id ?? null,
        email: data.session.user.email ?? identityInput.email ?? null,
        error_message: message,
        error_code: null,
        error_description: null,
        source_channel: failureContext.source_channel,
      })
    }

    await sendGoogleCallbackFailure({
      visitor_uuid: payload.visitor_uuid,
      user_uuid: payload.user_uuid,
      reason: payload.reason,
      auth_user_id: payload.auth_user_id,
      email: payload.email,
      error_message: payload.error_message,
      error_code: payload.error_code,
      error_description: null,
      source_channel: payload.source_channel,
    })
    console.error("[GOOGLE_OAUTH_LINK_FAILED]", payload)

    return redirectAuthError(request, "link_failed")
  }
}
