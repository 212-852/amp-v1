import { cookies } from "next/headers"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { resolveAuthContext } from "@/core/auth/context"
import {
  normalizeGoogleIdentityInput,
  sendIdentityDebug,
} from "@/core/auth/identity"
import { linkCurrentVisitorToIdentity } from "@/core/auth/link"
import { resolveSession } from "@/core/auth/session"
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

export async function completeGoogleOAuthCallback(request: NextRequest) {
  const requestUrl = request.nextUrl
  const code = requestUrl.searchParams.get("code")
  const error = requestUrl.searchParams.get("error")
  const error_code = requestUrl.searchParams.get("error_code")
  const error_description = requestUrl.searchParams.get("error_description")

  await sendIdentityDebug("auth_callback_received", {
    provider: "google",
    code_exists: Boolean(code),
    error,
    error_code,
    error_description,
  })

  const failureContext = await resolveFailureContext()

  if (error) {
    await sendIdentityDebug("identity_link_failed", {
      provider: "google",
      visitor_uuid: failureContext.visitor_uuid,
      user_uuid: failureContext.user_uuid,
      reason: "oauth_error_before_exchange",
      error,
      error_code,
      error_description,
      source_channel: failureContext.source_channel,
    })

    return redirectGoogleError(request)
  }

  if (!code) {
    await sendIdentityDebug("identity_link_failed", {
      provider: "google",
      visitor_uuid: failureContext.visitor_uuid,
      user_uuid: failureContext.user_uuid,
      reason: "missing_code",
      error: "Google callback did not include code",
      error_code: null,
      error_description: null,
      source_channel: failureContext.source_channel,
    })

    return NextResponse.redirect(new URL("/?auth_error=missing_code", appBaseUrl(request)))
  }

  const response = redirectHome(request)

  try {
    const cookieStore = await cookies()
    const supabase = create_server_supabase_client(cookieStore, response)
    const { data, error: exchangeError } = await supabase.auth
      .exchangeCodeForSession(code)
      .catch((exchangeError: unknown) => {
        const message =
          exchangeError instanceof Error ? exchangeError.message : String(exchangeError)

        return {
          data: { session: null },
          error: { message },
        }
      })

    if (exchangeError || !data.session?.user) {
      await sendIdentityDebug("google_code_exchange_failed", {
        provider: "google",
        visitor_uuid: failureContext.visitor_uuid,
        user_uuid: failureContext.user_uuid,
        error: exchangeError?.message ?? "Google session exchange failed",
        source_channel: failureContext.source_channel,
      })
      throw new Error(exchangeError?.message ?? "Google session exchange failed")
    }

    await sendIdentityDebug("google_code_exchange_success", {
      provider: "google",
      visitor_uuid: failureContext.visitor_uuid,
      user_uuid: failureContext.user_uuid,
      source_channel: failureContext.source_channel,
    })

    const identityInput = normalizeGoogleIdentityInput(data.session.user)
    const result = await linkCurrentVisitorToIdentity(identityInput)

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

    return response
  } catch (callbackError) {
    const message =
      callbackError instanceof Error ? callbackError.message : String(callbackError)

    await sendIdentityDebug("identity_link_failed", {
      provider: "google",
      visitor_uuid: failureContext.visitor_uuid,
      user_uuid: failureContext.user_uuid,
      reason: "exchange_or_link_failed",
      error: message,
      error_code: null,
      error_description: null,
      source_channel: failureContext.source_channel,
    })

    return redirectGoogleError(request)
  }
}
