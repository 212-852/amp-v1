import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { resolveAuthContext } from "@/core/auth/context"
import {
  resolveAuthUserProfile,
  sendIdentityDebug,
} from "@/core/auth/identity"
import { linkCurrentVisitorToIdentity } from "@/core/auth/link"
import { resolveSession } from "@/core/auth/session"
import { normalize_otp_code, normalize_otp_context } from "@/core/otp/context"
import { issue_otp, verify_otp } from "@/core/otp/action"
import { send_otp_email } from "@/core/otp/output"

async function readRequestBody(request: NextRequest) {
  return (await request.json().catch(() => ({}))) as Record<string, unknown>
}

function jsonError(error: unknown, fallback: string, status = 400) {
  const message = error instanceof Error ? error.message : fallback

  return NextResponse.json(
    {
      ok: false,
      success: false,
      error: message,
      message,
    },
    { status },
  )
}

function statusForError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)

  if (
    message.includes("Invalid OTP") ||
    message.includes("expired") ||
    message.includes("attempt") ||
    message.includes("already used") ||
    message.includes("not found")
  ) {
    return 403
  }

  return 400
}

async function buildLinkedEmailSession(input: { email: string }) {
  const result = await linkCurrentVisitorToIdentity({
    provider: "email",
    provider_user_id: input.email,
    email: input.email,
    display_name: input.email,
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
  try {
    const body = await readRequestBody(request)
    const context = await resolveAuthContext()
    const session = await resolveSession(context)
    const otpContext = normalize_otp_context({
      session,
      target: body.email,
      purpose: "login",
      channel: "email",
    })
    const issued = await issue_otp(otpContext)
    const sent = await send_otp_email(otpContext, {
      code: issued.code,
    })

    await sendIdentityDebug("otp_send_success", {
      purpose: otpContext.purpose,
      channel: otpContext.channel,
      target: otpContext.target,
      visitor_uuid: otpContext.visitor_uuid,
      user_uuid: otpContext.user_uuid,
      otp_uuid: issued.record?.otp_uuid ?? null,
      mail_provider: sent.provider,
      mail_id: sent.id ?? null,
    })

    return NextResponse.json({
      ok: true,
      success: true,
    })
  } catch (error) {
    return jsonError(error, "Failed to send OTP", statusForError(error))
  }
}

export async function verifyEmailOtpLogin(request: NextRequest) {
  try {
    const body = await readRequestBody(request)
    const context = await resolveAuthContext()
    const session = await resolveSession(context)
    const otpContext = normalize_otp_context({
      session,
      target: body.email,
      purpose: "login",
      channel: "email",
    })
    const code = normalize_otp_code(body.token)

    if (!code) {
      throw new Error("OTP code must be 6 digits")
    }

    await verify_otp(otpContext, code)

    const linkedSession = await buildLinkedEmailSession({
      email: otpContext.target,
    })

    return NextResponse.json({
      ok: true,
      success: true,
      session: linkedSession,
    })
  } catch (error) {
    return jsonError(error, "Failed to verify OTP", statusForError(error))
  }
}
