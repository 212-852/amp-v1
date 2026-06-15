import { cookies } from "next/headers"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { resolveAuthContext } from "@/core/auth/context"
import {
  resolveAuthUserProfile,
  sendIdentityDebug,
} from "@/core/auth/identity"
import { linkCurrentVisitorToIdentity } from "@/core/auth/link"
import { resolveSession } from "@/core/auth/session"
import {
  create_server_supabase_client,
  set_amp_auth_cookies,
} from "@/src/lib/supabase/server"

function normalizeEmail(value: unknown) {
  return typeof value === "string" && value.trim()
    ? value.trim().toLowerCase()
    : null
}

async function readRequestBody(request: NextRequest) {
  return (await request.json().catch(() => ({}))) as Record<string, unknown>
}

function serializeError(error: unknown) {
  if (!error || typeof error !== "object") {
    return error
  }

  const record = error as Record<string, unknown>

  return {
    name: record.name ?? null,
    message: record.message ?? null,
    status: record.status ?? null,
    code: record.code ?? null,
    details: record.details ?? null,
    hint: record.hint ?? null,
  }
}

function jsonError(error: unknown, fallback: string, status = 400) {
  const message = error instanceof Error ? error.message : fallback

  return NextResponse.json(
    {
      ok: false,
      success: false,
      error: message,
      message,
      details: serializeError(error),
    },
    { status },
  )
}

async function buildLinkedEmailSession(input: {
  email: string
  display_name?: string | null
}) {
  const result = await linkCurrentVisitorToIdentity({
    provider: "email",
    provider_user_id: input.email,
    email: input.email,
    display_name: input.display_name ?? input.email,
  })
  const profile = await resolveAuthUserProfile(result.user_uuid)
  const session = {
    visitor_uuid: result.visitor_uuid,
    user_uuid: result.user_uuid,
    role: profile.role,
    tier: profile.tier,
    display_name: profile.display_name,
    provider: "email",
    email: input.email,
    source_channel: result.source_channel,
  }

  await sendIdentityDebug("identity_link_success", {
    provider: "email",
    visitor_uuid: result.visitor_uuid,
    user_uuid: result.user_uuid,
    identity_uuid: result.identity_uuid,
    email: input.email,
    display_name: result.display_name,
    source_channel: result.source_channel,
  })
  await sendIdentityDebug("session_after_identity_link", session)

  return session
}

export async function startEmailOtpLogin(request: NextRequest) {
  const response = NextResponse.json({
    ok: true,
    success: true,
  })

  try {
    const body = await readRequestBody(request)
    const email = normalizeEmail(body.email)
    const context = await resolveAuthContext()
    const session = await resolveSession(context)

    if (!session.visitor_uuid) {
      throw new Error("Email login requires visitor_uuid")
    }

    if (!email) {
      throw new Error("Email is required")
    }

    const payload = {
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${request.nextUrl.origin}/auth/callback`,
      },
    }

    await sendIdentityDebug("email_send_request", {
      provider: "email",
      visitor_uuid: session.visitor_uuid,
      user_uuid: session.user_uuid,
      payload,
      source_channel: context.source_channel,
    })

    const cookieStore = await cookies()
    const supabase = create_server_supabase_client(cookieStore, response)
    const { data, error } = await supabase.auth.signInWithOtp(payload)

    await sendIdentityDebug("email_send_result", {
      provider: "email",
      visitor_uuid: session.visitor_uuid,
      user_uuid: session.user_uuid,
      email,
      success: !error,
      data,
      error: serializeError(error),
      source_channel: context.source_channel,
    })

    if (error) {
      throw new Error(error.message)
    }

    await sendIdentityDebug("email_magic_link_sent", {
      provider: "email",
      visitor_uuid: session.visitor_uuid,
      user_uuid: session.user_uuid,
      email,
      redirect_to: payload.options.emailRedirectTo,
      source_channel: context.source_channel,
    })

    return response
  } catch (error) {
    return jsonError(error, "Failed to send email magic link")
  }
}

export async function completeEmailMagicLinkCallback(request: NextRequest) {
  const homeUrl = new URL("/", request.url)
  const failureUrl = new URL("/", request.url)
  const response = NextResponse.redirect(homeUrl)
  const code = request.nextUrl.searchParams.get("code")
  const oauthError = request.nextUrl.searchParams.get("error")
  const errorCode = request.nextUrl.searchParams.get("error_code")
  const errorDescription = request.nextUrl.searchParams.get("error_description")

  await sendIdentityDebug("email_magic_callback_received", {
    provider: "email",
    code_exists: !!code,
    error: oauthError,
    error_code: errorCode,
    error_description: errorDescription,
    pathname: request.nextUrl.pathname,
  })

  if (oauthError || !code) {
    failureUrl.searchParams.set(
      "auth_error",
      oauthError ? "email_callback_error" : "missing_code",
    )
    await sendIdentityDebug("identity_link_failed", {
      provider: "email",
      reason: oauthError ? "email_callback_error" : "missing_code",
      error: oauthError,
      error_code: errorCode,
      error_description: errorDescription,
    })

    return NextResponse.redirect(failureUrl)
  }

  try {
    const cookieStore = await cookies()
    const supabase = create_server_supabase_client(cookieStore, response)
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    await sendIdentityDebug("email_magic_exchange_result", {
      provider: "email",
      success: !error,
      auth_user_id: data.user?.id ?? data.session?.user.id ?? null,
      email: data.user?.email ?? data.session?.user.email ?? null,
      session_exists: !!data.session,
      error: serializeError(error),
    })

    if (error) {
      throw new Error(error.message)
    }

    const authUser = data.user ?? data.session?.user
    const email = normalizeEmail(authUser?.email)

    if (!authUser?.id || !email) {
      throw new Error("Email magic link callback did not return an auth user")
    }

    const session = await buildLinkedEmailSession({
      email,
      display_name: authUser.email ?? email,
    })

    set_amp_auth_cookies(response, data.session)
    await sendIdentityDebug("email_verify_success", {
      provider: "email",
      visitor_uuid: session.visitor_uuid,
      user_uuid: session.user_uuid,
      auth_user_id: authUser.id,
      email,
      session_exists: !!data.session,
      source_channel: session.source_channel,
    })
    await sendIdentityDebug("email_ui_session_refreshed", {
      provider: "email",
      visitor_uuid: session.visitor_uuid,
      user_uuid: session.user_uuid,
      email,
      source_channel: session.source_channel,
    })

    return response
  } catch (error) {
    const message = error instanceof Error ? error.message : "Email callback failed"

    failureUrl.searchParams.set("auth_error", "email_callback_failed")
    await sendIdentityDebug("identity_link_failed", {
      provider: "email",
      reason: "email_callback_failed",
      error: message,
    })

    return NextResponse.redirect(failureUrl)
  }
}
