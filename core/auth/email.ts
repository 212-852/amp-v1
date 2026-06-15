import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { Buffer } from "node:buffer"

import { resolveAuthContext } from "@/core/auth/context"
import {
  resolveAuthUserProfile,
  sendIdentityDebug,
} from "@/core/auth/identity"
import { linkCurrentVisitorToIdentity } from "@/core/auth/link"
import { resolveSession } from "@/core/auth/session"
import { create_auth_supabase_client } from "@/core/auth/supabase"
import { set_amp_auth_cookies } from "@/src/lib/supabase/server"

const supabase_sdk_version = "2.108.2"

function decode_supabase_key_ref(key: string) {
  try {
    const payload = JSON.parse(
      Buffer.from(key.split(".")[1] ?? "", "base64url").toString("utf8"),
    ) as {
      ref?: string | null
      role?: string | null
      iss?: string | null
    }

    return {
      ref: payload.ref ?? null,
      role: payload.role ?? null,
      iss: payload.iss ?? null,
    }
  } catch {
    return {
      ref: null,
      role: null,
      iss: null,
    }
  }
}

function get_auth_client_debug_config() {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const decoded = key ? decode_supabase_key_ref(key) : null

  return {
    supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? null,
    has_anon_key: !!key,
    anon_key_prefix: key?.slice(0, 12) ?? null,
    anon_key_ref: decoded?.ref ?? null,
    anon_key_role: decoded?.role ?? null,
    anon_key_iss: decoded?.iss ?? null,
    using_service_role: false,
  }
}

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
    await sendIdentityDebug("email_auth_client_config", {
      provider: "email",
      step: "start",
      ...get_auth_client_debug_config(),
      source_channel: context.source_channel,
    })

    const supabase = create_auth_supabase_client()
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
  let response_email: string | null = null
  let response_visitor_uuid: string | null = null
  let response_verify_type: string | null = null
  let response_auth_user_id: string | null = null
  let response_session_exists = false

  async function emailVerifyApiResponse(input: {
    status: 200 | 401 | 403 | 409 | 500
    success: boolean
    error: string | null
    verify_type?: string | null
    details?: Record<string, unknown>
    session?: Record<string, unknown>
  }) {
    const verify_type = input.verify_type ?? response_verify_type

    await sendIdentityDebug("email_verify_api_response", {
      provider: "email",
      status: input.status,
      success: input.success,
      error: input.error,
      verify_type,
      email: response_email,
      visitor_uuid: response_visitor_uuid,
      auth_user_id: response_auth_user_id,
      session_exists: response_session_exists,
      details: input.details ?? null,
    })

    return NextResponse.json(
      {
        ok: input.success,
        success: input.success,
        error: input.error,
        message: input.error,
        verify_type,
        details: input.details ?? null,
        session: input.session,
      },
      { status: input.status },
    )
  }

  try {
    const body = await readRequestBody(request)
    const email = normalizeEmail(body.email)
    const raw_token = body.token ?? body.code
    const normalized_token = normalizeCode(raw_token)
    const context = await resolveAuthContext()
    const session = await resolveSession(context)

    response_email = email
    response_visitor_uuid = session.visitor_uuid

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
      return emailVerifyApiResponse({
        status: 401,
        success: false,
        error: "Email verification requires visitor_uuid",
        details: { reason: "visitor_missing" },
      })
    }

    if (!email) {
      return emailVerifyApiResponse({
        status: 403,
        success: false,
        error: "Email is required",
        details: { reason: "email_missing" },
      })
    }

    if (!/^\d{6}$/.test(normalized_token)) {
      return emailVerifyApiResponse({
        status: 403,
        success: false,
        error: "Verification code must be 6 digits",
        details: { reason: "invalid_token_format" },
      })
    }

    const auth_config = get_auth_client_debug_config()

    await sendIdentityDebug("email_auth_client_config", {
      provider: "email",
      step: "verify",
      ...auth_config,
      source_channel: context.source_channel,
    })

    const supabase = create_auth_supabase_client()
    const verify_type = "email"

    await sendIdentityDebug("email_verify_attempt", {
      provider: "email",
      visitor_uuid: session.visitor_uuid,
      email,
      token: normalized_token,
      type: verify_type,
      supabase_sdk_version,
      source_channel: context.source_channel,
    })
    await sendIdentityDebug("email_verify_payload", {
      provider: "email",
      visitor_uuid: session.visitor_uuid,
      email,
      token: normalized_token,
      type: verify_type,
      supabase_sdk_version,
      source_channel: context.source_channel,
    })

    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: normalized_token,
      type: verify_type,
    })

    response_verify_type = verify_type
    response_auth_user_id = data.user?.id ?? null
    response_session_exists = !!data.session

    await sendIdentityDebug("email_verify_attempt_result", {
      provider: "email",
      visitor_uuid: session.visitor_uuid,
      email,
      verify_type,
      success: !error,
      auth_user_id: data.user?.id ?? null,
      session_exists: !!data.session,
      error_message: error?.message ?? null,
      error_status: error?.status ?? null,
      supabase_sdk_version,
      source_channel: context.source_channel,
    })

    await sendIdentityDebug("email_verify_result", {
      provider: "email",
      visitor_uuid: session.visitor_uuid,
      email,
      token_length: normalized_token.length,
      type: verify_type,
      successful_type: error ? null : verify_type,
      success: !error,
      auth_user_id: data.user?.id ?? null,
      user_id: data.user?.id ?? null,
      session_exists: !!data.session,
      error_message: error?.message ?? null,
      error_status: error?.status ?? null,
      supabase_sdk_version,
      source_channel: context.source_channel,
    })

    if (error) {
      await sendIdentityDebug("email_verify_api_response", {
        provider: "email",
        status: 403,
        success: false,
        error: error.message,
        verify_type,
        email,
        visitor_uuid: session.visitor_uuid,
        auth_user_id: null,
        session_exists: false,
        details: {
          reason: "supabase_email_otp_invalid",
          supabase_url: auth_config.supabase_url,
          anon_key_ref: auth_config.anon_key_ref,
          error_status: error.status ?? null,
        },
      })

      return NextResponse.json(
        {
          ok: false,
          reason: "supabase_email_otp_invalid",
          email,
          token: normalized_token,
          type: verify_type,
          supabase_url: auth_config.supabase_url,
          anon_key_ref: auth_config.anon_key_ref,
          error_message: error.message,
          error_status: error.status ?? null,
        },
        { status: 403 },
      )
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
    await sendIdentityDebug("email_session_update", {
      provider: "email",
      visitor_uuid: result.visitor_uuid,
      user_uuid: result.user_uuid,
      verify_type,
      session_exists: !!data.session,
      source_channel: result.source_channel,
    })

    const response = NextResponse.json({
      ok: true,
      success: true,
      session: payload,
    })

    set_amp_auth_cookies(response, data.session)
    await sendIdentityDebug("email_verify_api_response", {
      provider: "email",
      status: 200,
      success: true,
      error: null,
      verify_type,
      email,
      visitor_uuid: result.visitor_uuid,
      auth_user_id: data.user.id,
      session_exists: !!data.session,
      details: null,
    })

    return response
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to verify email OTP"
    const status = message.includes("already linked") ? 409 : 500

    return emailVerifyApiResponse({
      status,
      success: false,
      error: message,
      details: {
        reason: status === 409 ? "identity_conflict" : "internal_error",
      },
    })
  }
}
