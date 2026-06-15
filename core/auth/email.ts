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
  create_auth_supabase_client,
  create_service_role_supabase_client,
  get_shared_auth_supabase_client,
} from "@/core/auth/supabase"
import { set_amp_auth_cookies } from "@/src/lib/supabase/server"

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

function summarizeAuthState(input: {
  session: Awaited<ReturnType<ReturnType<typeof create_auth_supabase_client>["auth"]["getSession"]>>
  user: Awaited<ReturnType<ReturnType<typeof create_auth_supabase_client>["auth"]["getUser"]>>
}) {
  return {
    session: {
      exists: !!input.session.data.session,
      user_id: input.session.data.session?.user.id ?? null,
      user_email: input.session.data.session?.user.email ?? null,
      error: serializeError(input.session.error),
    },
    user: {
      id: input.user.data.user?.id ?? null,
      email: input.user.data.user?.email ?? null,
      error: serializeError(input.user.error),
    },
  }
}

async function findAuthUserByEmail(email: string) {
  const admin = create_service_role_supabase_client()
  const result = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  })
  const user = result.data.users.find((item) => item.email?.toLowerCase() === email)

  return {
    user,
    error: result.error,
  }
}

export async function startEmailOtpLogin(request: NextRequest) {
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
      },
    }

    await sendIdentityDebug("email_send_request", {
      provider: "email",
      visitor_uuid: session.visitor_uuid,
      user_uuid: session.user_uuid,
      payload,
      source_channel: context.source_channel,
    })

    const supabase = get_shared_auth_supabase_client()
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

    const authUserResult = await findAuthUserByEmail(email)
    const authUser = authUserResult.user

    await sendIdentityDebug("email_user_exists_after_send", {
      provider: "email",
      visitor_uuid: session.visitor_uuid,
      user_uuid: session.user_uuid,
      email,
      exists: !!authUser,
      auth_user_id: authUser?.id ?? null,
      email_confirmed_at: authUser?.email_confirmed_at ?? null,
      created_at: authUser?.created_at ?? null,
      error: serializeError(authUserResult.error),
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

    return NextResponse.json({
      ok: true,
      success: true,
      email,
    })
  } catch (error) {
    return jsonError(error, "Failed to send email OTP")
  }
}

export async function verifyEmailOtpLogin(request: NextRequest) {
  try {
    const body = await readRequestBody(request)
    const email = normalizeEmail(body.email)
    const token = normalizeCode(body.token ?? body.code)
    const context = await resolveAuthContext()
    const session = await resolveSession(context)

    await sendIdentityDebug("email_verify_request_received", {
      provider: "email",
      email,
      token,
      token_length: token.length,
      source_channel: context.source_channel,
      visitor_uuid: session.visitor_uuid,
    })

    if (!session.visitor_uuid) {
      return jsonError(new Error("Email verification requires visitor_uuid"), "", 401)
    }

    if (!email) {
      return jsonError(new Error("Email is required"), "", 403)
    }

    if (!/^\d{6}$/.test(token)) {
      return jsonError(new Error("Verification code must be 6 digits"), "", 403)
    }

    const payload = {
      email,
      token,
      type: "email" as const,
    }

    const supabase = get_shared_auth_supabase_client()
    const preSession = await supabase.auth.getSession()
    const preUser = await supabase.auth.getUser()
    const authUserResult = email ? await findAuthUserByEmail(email) : null
    const authUser = authUserResult?.user ?? null

    await sendIdentityDebug("email_verify_payload", {
      provider: "email",
      visitor_uuid: session.visitor_uuid,
      payload,
      auth_state_before_verify: summarizeAuthState({
        session: preSession,
        user: preUser,
      }),
      auth_user_match: {
        email,
        exists: !!authUser,
        auth_user_id: authUser?.id ?? null,
        email_confirmed_at: authUser?.email_confirmed_at ?? null,
        created_at: authUser?.created_at ?? null,
        admin_error: serializeError(authUserResult?.error),
      },
      source_channel: context.source_channel,
    })

    const result = await supabase.auth.verifyOtp(payload)
    const postSession = await supabase.auth.getSession()
    const postUser = await supabase.auth.getUser()

    await sendIdentityDebug("email_verify_result", {
      provider: "email",
      visitor_uuid: session.visitor_uuid,
      payload,
      success: !result.error,
      data: {
        user_id: result.data.user?.id ?? null,
        user_email: result.data.user?.email ?? null,
        session_exists: !!result.data.session,
      },
      error: serializeError(result.error),
      auth_state_after_verify: summarizeAuthState({
        session: postSession,
        user: postUser,
      }),
      auth_user_match: {
        email,
        exists: !!authUser,
        auth_user_id: authUser?.id ?? null,
        verify_user_id: result.data.user?.id ?? null,
        same_user: !!authUser?.id && authUser.id === result.data.user?.id,
      },
      source_channel: context.source_channel,
    })

    if (result.error) {
      return NextResponse.json(
        {
          ok: false,
          success: false,
          error: result.error.message,
          message: result.error.message,
          payload,
          supabase_error: serializeError(result.error),
        },
        { status: result.error.status ?? 403 },
      )
    }

    if (!result.data.user?.id) {
      throw new Error("Email OTP did not return an auth user")
    }

    const linkResult = await linkCurrentVisitorToIdentity({
      provider: "email",
      provider_user_id: email,
      email,
      display_name: result.data.user.email ?? email,
    })
    const profile = await resolveAuthUserProfile(linkResult.user_uuid)
    const sessionPayload = {
      visitor_uuid: linkResult.visitor_uuid,
      user_uuid: linkResult.user_uuid,
      role: profile.role,
      tier: profile.tier,
      display_name: profile.display_name,
      provider: "email",
      provider_user_id: email,
      email,
      source_channel: linkResult.source_channel,
    }

    await sendIdentityDebug("identity_link_success", {
      provider: "email",
      visitor_uuid: linkResult.visitor_uuid,
      user_uuid: linkResult.user_uuid,
      identity_uuid: linkResult.identity_uuid,
      email,
      display_name: linkResult.display_name,
      source_channel: linkResult.source_channel,
    })
    await sendIdentityDebug("session_after_identity_link", sessionPayload)

    const response = NextResponse.json({
      ok: true,
      success: true,
      session: sessionPayload,
    })

    set_amp_auth_cookies(response, result.data.session)

    return response
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to verify email OTP"
    const status = message.includes("already linked") ? 409 : 500

    return jsonError(error, "Failed to verify email OTP", status)
  }
}
