import { createHash, randomInt, timingSafeEqual } from "node:crypto"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { resolveAuthContext } from "@/core/auth/context"
import {
  resolveAuthUserProfile,
  sendIdentityDebug,
} from "@/core/auth/identity"
import { linkCurrentVisitorToIdentity } from "@/core/auth/link"
import { resolveSession } from "@/core/auth/session"
import { getRestConfig, readRestError, restHeaders, restUrl } from "@/core/db/rest"
import { sendMail } from "@/core/mail/action"

const EMAIL_CODE_TTL_MS = 10 * 60 * 1000

type EmailCodeRow = {
  code_uuid?: string | null
  code_hash?: string | null
  expires_at?: string | null
  consumed_at?: string | null
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

function createEmailCode() {
  return String(randomInt(0, 1000000)).padStart(6, "0")
}

function emailCodeSecret() {
  return (
    process.env.EMAIL_CODE_SECRET ??
    process.env.AUTH_SECRET ??
    process.env.NEXTAUTH_SECRET ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    "amp-email-code-dev"
  )
}

function hashEmailCode(input: {
  visitor_uuid: string
  email: string
  code: string
}) {
  return createHash("sha256")
    .update(`${input.visitor_uuid}:${input.email}:${input.code}:${emailCodeSecret()}`)
    .digest("hex")
}

function hashesMatch(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "hex")
  const rightBuffer = Buffer.from(right, "hex")

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}

async function expirePreviousCodes(input: {
  visitor_uuid: string
  email: string
}) {
  const config = getRestConfig()

  if (!config) {
    throw new Error("Database config is missing")
  }

  const response = await fetch(
    restUrl(
      config,
      "email_codes",
      [
        `visitor_uuid=eq.${encodeURIComponent(input.visitor_uuid)}`,
        `email=eq.${encodeURIComponent(input.email)}`,
        "consumed_at=is.null",
      ].join("&"),
    ),
    {
      method: "PATCH",
      headers: {
        ...restHeaders(config),
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        consumed_at: new Date().toISOString(),
      }),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    const error = await readRestError(response)

    throw new Error(
      `Failed to expire email codes: ${error.code ?? "unknown"} ${
        error.message ?? "No PostgREST error returned"
      }`,
    )
  }
}

async function insertEmailCode(input: {
  visitor_uuid: string
  email: string
  code_hash: string
  expires_at: string
}) {
  const config = getRestConfig()

  if (!config) {
    throw new Error("Database config is missing")
  }

  const response = await fetch(restUrl(config, "email_codes", "select=code_uuid"), {
    method: "POST",
    headers: {
      ...restHeaders(config),
      Prefer: "return=representation",
    },
    body: JSON.stringify(input),
    cache: "no-store",
  })

  if (!response.ok) {
    const error = await readRestError(response)

    throw new Error(
      `Failed to create email code: ${error.code ?? "unknown"} ${
        error.message ?? "No PostgREST error returned"
      }`,
    )
  }

  const rows = (await response.json()) as EmailCodeRow[]

  return rows[0]?.code_uuid ?? null
}

async function loadLatestEmailCode(input: {
  visitor_uuid: string
  email: string
}) {
  const config = getRestConfig()

  if (!config) {
    throw new Error("Database config is missing")
  }

  const response = await fetch(
    restUrl(
      config,
      "email_codes",
      [
        `visitor_uuid=eq.${encodeURIComponent(input.visitor_uuid)}`,
        `email=eq.${encodeURIComponent(input.email)}`,
        "consumed_at=is.null",
        "select=code_uuid,code_hash,expires_at,consumed_at",
        "order=created_at.desc",
        "limit=1",
      ].join("&"),
    ),
    {
      headers: restHeaders(config),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    const error = await readRestError(response)

    throw new Error(
      `Failed to load email code: ${error.code ?? "unknown"} ${
        error.message ?? "No PostgREST error returned"
      }`,
    )
  }

  const rows = (await response.json()) as EmailCodeRow[]

  return rows[0] ?? null
}

async function consumeEmailCode(code_uuid: string) {
  const config = getRestConfig()

  if (!config) {
    throw new Error("Database config is missing")
  }

  const response = await fetch(
    restUrl(config, "email_codes", `code_uuid=eq.${encodeURIComponent(code_uuid)}`),
    {
      method: "PATCH",
      headers: {
        ...restHeaders(config),
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        consumed_at: new Date().toISOString(),
      }),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    const error = await readRestError(response)

    throw new Error(
      `Failed to consume email code: ${error.code ?? "unknown"} ${
        error.message ?? "No PostgREST error returned"
      }`,
    )
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

    const code = createEmailCode()
    const code_hash = hashEmailCode({
      visitor_uuid: session.visitor_uuid,
      email,
      code,
    })
    const expires_at = new Date(Date.now() + EMAIL_CODE_TTL_MS).toISOString()

    await expirePreviousCodes({
      visitor_uuid: session.visitor_uuid,
      email,
    })
    const code_uuid = await insertEmailCode({
      visitor_uuid: session.visitor_uuid,
      email,
      code_hash,
      expires_at,
    })
    await sendMail({
      to: email,
      subject: "AMP verification code",
      text: `Your AMP verification code is ${code}. It expires in 10 minutes.`,
    })

    await sendIdentityDebug("email_code_created", {
      provider: "email",
      visitor_uuid: session.visitor_uuid,
      user_uuid: session.user_uuid,
      code_uuid,
      email,
      expires_at,
      source_channel: context.source_channel,
    })
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
      expires_at,
    })
  } catch (error) {
    return jsonError(error, "Failed to send email code")
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

    const row = await loadLatestEmailCode({
      visitor_uuid: session.visitor_uuid,
      email,
    })

    if (!row?.code_uuid || !row.code_hash || !row.expires_at) {
      await sendIdentityDebug("email_verify_result", {
        provider: "email",
        visitor_uuid: session.visitor_uuid,
        email,
        success: false,
        reason: "code_missing",
        source_channel: context.source_channel,
      })

      return jsonError(new Error("Verification code is invalid"), "", 403)
    }

    if (Date.parse(row.expires_at) <= Date.now()) {
      await sendIdentityDebug("email_verify_result", {
        provider: "email",
        visitor_uuid: session.visitor_uuid,
        email,
        success: false,
        reason: "code_expired",
        code_uuid: row.code_uuid,
        source_channel: context.source_channel,
      })

      return jsonError(new Error("Verification code has expired"), "", 403)
    }

    const expected_hash = hashEmailCode({
      visitor_uuid: session.visitor_uuid,
      email,
      code: token,
    })

    if (!hashesMatch(expected_hash, row.code_hash)) {
      await sendIdentityDebug("email_verify_result", {
        provider: "email",
        visitor_uuid: session.visitor_uuid,
        email,
        success: false,
        reason: "code_mismatch",
        code_uuid: row.code_uuid,
        source_channel: context.source_channel,
      })

      return jsonError(new Error("Verification code is invalid"), "", 403)
    }

    await consumeEmailCode(row.code_uuid)

    const result = await linkCurrentVisitorToIdentity({
      provider: "email",
      provider_user_id: email,
      email,
      display_name: email,
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

    return NextResponse.json({
      ok: true,
      success: true,
      session: payload,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to verify email code"
    const status = message.includes("already linked") ? 409 : 500

    return jsonError(error, "Failed to verify email code", status)
  }
}
