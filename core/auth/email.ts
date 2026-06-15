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

const supabase_sdk_version = "2.108.2"
const email_verify_types = ["email", "magiclink"] as const

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
    await sendIdentityDebug("email_provider_config", {
      provider: "email",
      email,
      email_provider_enabled: true,
      source_channel: context.source_channel,
    })
    await sendIdentityDebug("email_send_method", {
      provider: "email",
      send_function: "signInWithOtp",
      email,
      supabase_sdk_version,
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
    let verified_data: Awaited<ReturnType<typeof supabase.auth.verifyOtp>>["data"] | null =
      null
    let verify_error: Awaited<ReturnType<typeof supabase.auth.verifyOtp>>["error"] | null =
      null
    let successful_type: (typeof email_verify_types)[number] | null = null

    await sendIdentityDebug("email_verify_attempt", {
      provider: "email",
      visitor_uuid: session.visitor_uuid,
      email,
      token: normalized_token,
      type: "email",
      supabase_sdk_version,
      source_channel: context.source_channel,
    })

    for (const verify_type of email_verify_types) {
      await sendIdentityDebug("email_verify_payload", {
        provider: "email",
        visitor_uuid: session.visitor_uuid,
        email,
        token: normalized_token,
        type: verify_type,
        supabase_sdk_version,
        source_channel: context.source_channel,
      })

      const result = await supabase.auth.verifyOtp({
        email,
        token: normalized_token,
        type: verify_type,
      })

      await sendIdentityDebug("email_verify_attempt_result", {
        provider: "email",
        visitor_uuid: session.visitor_uuid,
        email,
        verify_type,
        success: !result.error,
        auth_user_id: result.data.user?.id ?? null,
        session_exists: !!result.data.session,
        error_message: result.error?.message ?? null,
        error_status: result.error?.status ?? null,
        supabase_sdk_version,
        source_channel: context.source_channel,
      })

      verified_data = result.data
      verify_error = result.error

      if (!result.error) {
        successful_type = verify_type
        break
      }
    }

    await sendIdentityDebug("email_verify_result", {
      provider: "email",
      visitor_uuid: session.visitor_uuid,
      email,
      token_length: normalized_token.length,
      type: successful_type ?? email_verify_types[email_verify_types.length - 1],
      successful_type,
      success: !verify_error,
      auth_user_id: verified_data?.user?.id ?? null,
      user_id: verified_data?.user?.id ?? null,
      session_exists: !!verified_data?.session,
      error_message: verify_error?.message ?? null,
      error_status: verify_error?.status ?? null,
      supabase_sdk_version,
      source_channel: context.source_channel,
    })

    if (verify_error) {
      return jsonFailure({
        reason: "email_verify_failed",
        message: verify_error.message,
      })
    }

    if (!verified_data?.user?.id) {
      throw new Error("Email OTP did not return an auth user")
    }

    const result = await linkCurrentVisitorToIdentity({
      provider: "email",
      provider_user_id: email,
      email,
      display_name: verified_data.user.user_metadata?.name ?? email,
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

    set_amp_auth_cookies(response, verified_data.session)

    return response
  } catch (error) {
    return jsonError(error, "Failed to verify email OTP")
  }
}
