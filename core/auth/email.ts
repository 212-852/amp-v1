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
  return typeof value === "string" ? value.replace(/\D/g, "").slice(0, 6) : null
}

async function readRequestBody(request: NextRequest) {
  return (await request.json().catch(() => ({}))) as Record<string, unknown>
}

function jsonError(error: unknown, fallback: string) {
  return NextResponse.json(
    {
      ok: false,
      error: error instanceof Error ? error.message : fallback,
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

    const cookieStore = await cookies()
    const supabase = create_server_supabase_client(cookieStore, response)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: undefined,
        shouldCreateUser: true,
      },
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
    const token = normalizeCode(body.code)
    const context = await resolveAuthContext()
    const session = await resolveSession(context)

    if (!session.visitor_uuid) {
      throw new Error("Email verification requires visitor_uuid")
    }

    if (!email) {
      throw new Error("Email is required")
    }

    if (!token || token.length !== 6) {
      throw new Error("Verification code must be 6 digits")
    }

    const cookieStore = await cookies()
    const supabase = create_server_supabase_client(cookieStore, authResponse)
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: "email",
    })

    if (error) {
      throw new Error(error.message)
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
