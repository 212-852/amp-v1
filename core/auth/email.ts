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

function normalizeCode(value: unknown) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, "")
}

async function readRequestBody(request: NextRequest) {
  return (await request.json().catch(() => ({}))) as Record<string, unknown>
}

function jsonError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback

  return NextResponse.json(
    {
      ok: false,
      error: message,
      message,
    },
    { status: 400 },
  )
}

function jsonFailure(input: {
  reason: string
  message: string
  status?: number
}) {
  return NextResponse.json(
    {
      ok: false,
      reason: input.reason,
      error: input.message,
      message: input.message,
    },
    { status: input.status ?? 400 },
  )
}

export async function startEmailOtpLogin(request: NextRequest) {
  try {
    const body = await readRequestBody(request)
    const email = normalizeEmail(body.email)
    const context = await resolveAuthContext()
    const session = await resolveSession(context)
    const response = NextResponse.json({
      ok: true,
      email,
    })

    if (!session.visitor_uuid) {
      throw new Error("Email login requires visitor_uuid")
    }

    if (!email) {
      throw new Error("Email is required")
    }

    await sendIdentityDebug("email_send_request", {
      provider: "email",
      visitor_uuid: session.visitor_uuid,
      user_uuid: session.user_uuid,
      email,
      source_channel: context.source_channel,
    })

    const cookieStore = await cookies()
    const supabase = create_server_supabase_client(cookieStore, response)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
      },
    })

    await sendIdentityDebug("email_send_result", {
      provider: "email",
      visitor_uuid: session.visitor_uuid,
      user_uuid: session.user_uuid,
      email,
      success: !error,
      error_message: error?.message ?? null,
      source_channel: context.source_channel,
    })

    if (error) {
      throw new Error(error.message)
    }

    await sendIdentityDebug("email_otp_sent", {
      provider: "email",
      visitor_uuid: session.visitor_uuid,
      user_uuid: session.user_uuid,
      email,
      source_channel: context.source_channel,
    })

    return response
  } catch (error) {
    return jsonError(error, "Failed to send email OTP")
  }
}

export async function verifyEmailOtpLogin(request: NextRequest) {
  const authResponse = NextResponse.json({
    ok: false,
  })

  try {
    const body = await readRequestBody(request)
    const email = normalizeEmail(body.email)
    const raw_token = body.token ?? body.code
    const normalized_token = normalizeCode(raw_token)
    const context = await resolveAuthContext()
    const session = await resolveSession(context)

    await sendIdentityDebug("email_verify_request_received", {
      provider: "email",
      email,
      token: raw_token,
      token_length: typeof raw_token === "string" ? raw_token.length : 0,
      token_trimmed: String(raw_token ?? "").trim(),
      source_channel: context.source_channel,
      visitor_uuid: session.visitor_uuid,
    })

    if (!session.visitor_uuid) {
      return jsonFailure({
        reason: "visitor_missing",
        message: "Email verification requires visitor_uuid",
      })
    }

    if (!email) {
      return jsonFailure({
        reason: "email_missing",
        message: "Email is required",
      })
    }

    if (!/^\d{6}$/.test(normalized_token)) {
      return jsonFailure({
        reason: "invalid_token_format",
        message: "Verification code must be 6 digits",
      })
    }

    const cookieStore = await cookies()
    const supabase = create_server_supabase_client(cookieStore, authResponse)
    const type = "email"

    await sendIdentityDebug("email_verify_attempt", {
      provider: "email",
      visitor_uuid: session.visitor_uuid,
      email,
      token: normalized_token,
      type,
      source_channel: context.source_channel,
    })

    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: normalized_token,
      type,
    })

    await sendIdentityDebug("email_verify_result", {
      provider: "email",
      visitor_uuid: session.visitor_uuid,
      email,
      token_length: normalized_token.length,
      type,
      success: !error,
      auth_user_id: data.user?.id ?? null,
      user_id: data.user?.id ?? null,
      session_exists: !!data.session,
      error_message: error?.message ?? null,
      error_status: error?.status ?? null,
      source_channel: context.source_channel,
    })

    if (error) {
      return jsonFailure({
        reason: "email_verify_failed",
        message: error.message,
      })
    }

    if (!data.user?.id) {
      throw new Error("Email OTP did not return an auth user")
    }

    const result = await linkCurrentVisitorToIdentity({
      provider: "email",
      provider_user_id: email,
      email,
      display_name: data.user.user_metadata?.name ?? email,
    })
    const profile = await resolveAuthUserProfile(result.user_uuid)
    const payload = {
      visitor_uuid: result.visitor_uuid,
      user_uuid: result.user_uuid,
      role: profile.role,
      tier: profile.tier,
      display_name: profile.display_name,
      provider: "email",
      provider_user_id: email,
      email,
      source_channel: result.source_channel,
    }

    await sendIdentityDebug("identity_link_success", {
      provider: "email",
      visitor_uuid: result.visitor_uuid,
      user_uuid: result.user_uuid,
      identity_uuid: result.identity_uuid,
      email,
      display_name: result.display_name,
      source_channel: result.source_channel,
    })
    await sendIdentityDebug("session_after_identity_link", payload)

    const response = NextResponse.json({
      ok: true,
      session: payload,
    })

    set_amp_auth_cookies(response, data.session)

    return response
  } catch (error) {
    return jsonError(error, "Failed to verify email OTP")
  }
}
