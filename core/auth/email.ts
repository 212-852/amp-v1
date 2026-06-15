import { resolveAuthContext } from "@/core/auth/context"
import {
  resolveAuthUserProfile,
  sendIdentityDebug,
} from "@/core/auth/identity"
import { linkCurrentVisitorToIdentity } from "@/core/auth/link"
import { resolveSession } from "@/core/auth/session"
import { getRestConfig, readRestError, restHeaders, restUrl } from "@/core/db/rest"

const EMAIL_CODE_TTL_MS = 10 * 60 * 1000

type EmailCodeRow = {
  code_uuid: string
  code_hash: string
  expires_at: string
  consumed_at: string | null
}

function normalizeEmail(value: unknown) {
  return typeof value === "string" && value.trim()
    ? value.trim().toLowerCase()
    : null
}

function normalizeCode(value: unknown) {
  return typeof value === "string" ? value.replace(/\D/g, "").slice(0, 6) : null
}

function createEmailCode() {
  const array = new Uint32Array(1)
  crypto.getRandomValues(array)

  return String(array[0] % 1000000).padStart(6, "0")
}

async function hashEmailCode(input: {
  visitor_uuid: string
  email: string
  code: string
}) {
  const secret =
    process.env.EMAIL_CODE_SECRET ??
    process.env.AUTH_SECRET ??
    process.env.NEXTAUTH_SECRET ??
    "amp-email-code"
  const text = `${input.visitor_uuid}:${input.email}:${input.code}:${secret}`
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
}

async function sendEmailCode(input: { email: string; code: string }) {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM

  if (!apiKey || !from) {
    console.warn("[EMAIL_CODE_SEND_SKIPPED]", {
      reason: "RESEND_API_KEY or EMAIL_FROM is missing",
      email: input.email,
    })
    return
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: input.email,
      subject: "AMP verification code",
      text: `Your AMP verification code is ${input.code}. It expires in 10 minutes.`,
    }),
    cache: "no-store",
  })

  if (!response.ok) {
    const error = await response.text().catch(() => "")
    throw new Error(error || `Failed to send email code: ${response.status}`)
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
    return
  }

  const response = await fetch(restUrl(config, "email_codes", "select=code_uuid"), {
    method: "POST",
    headers: {
      ...restHeaders(config),
      Prefer: "return=minimal",
    },
    body: JSON.stringify(input),
    cache: "no-store",
  })

  if (!response.ok) {
    const error = await readRestError(response)
    throw new Error(
      `Failed to save email code: ${error.code ?? "unknown"} ${
        error.message ?? "No PostgREST error returned"
      }`,
    )
  }
}

async function loadEmailCodes(input: { visitor_uuid: string; email: string }) {
  const config = getRestConfig()

  if (!config) {
    return []
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
        "limit=5",
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

  return (await response.json()) as EmailCodeRow[]
}

async function markEmailCodeConsumed(code_uuid: string) {
  const config = getRestConfig()

  if (!config) {
    return
  }

  const response = await fetch(
    restUrl(config, "email_codes", `code_uuid=eq.${encodeURIComponent(code_uuid)}`),
    {
      method: "PATCH",
      headers: restHeaders(config),
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

export async function startEmailCodeLogin(input: Record<string, unknown>) {
  const email = normalizeEmail(input.email)
  const context = await resolveAuthContext()
  const session = await resolveSession(context)

  if (!session.visitor_uuid) {
    throw new Error("Email login requires visitor_uuid")
  }

  if (!email) {
    throw new Error("Email is required")
  }

  const code = createEmailCode()
  const code_hash = await hashEmailCode({
    visitor_uuid: session.visitor_uuid,
    email,
    code,
  })
  const expires_at = new Date(Date.now() + EMAIL_CODE_TTL_MS).toISOString()

  await insertEmailCode({
    visitor_uuid: session.visitor_uuid,
    email,
    code_hash,
    expires_at,
  })
  await sendEmailCode({ email, code })
  await sendIdentityDebug("email_code_sent", {
    provider: "email",
    visitor_uuid: session.visitor_uuid,
    user_uuid: session.user_uuid,
    email,
    source_channel: context.source_channel,
  })

  return {
    ok: true,
    email,
    expires_at,
  }
}

export async function verifyEmailCodeLogin(input: Record<string, unknown>) {
  const email = normalizeEmail(input.email)
  const code = normalizeCode(input.code)
  const context = await resolveAuthContext()
  const session = await resolveSession(context)

  if (!session.visitor_uuid) {
    throw new Error("Email verification requires visitor_uuid")
  }

  if (!email) {
    throw new Error("Email is required")
  }

  if (!code || code.length !== 6) {
    throw new Error("Verification code must be 6 digits")
  }

  const code_hash = await hashEmailCode({
    visitor_uuid: session.visitor_uuid,
    email,
    code,
  })
  const rows = await loadEmailCodes({
    visitor_uuid: session.visitor_uuid,
    email,
  })
  const matched = rows.find((row) => row.code_hash === code_hash)

  if (!matched) {
    throw new Error("Verification code is invalid")
  }

  if (Date.parse(matched.expires_at) <= Date.now()) {
    throw new Error("Verification code has expired")
  }

  await markEmailCodeConsumed(matched.code_uuid)

  const result = await linkCurrentVisitorToIdentity({
    provider: "email",
    provider_user_id: email,
    email,
    display_name: email,
  })
  const profile = await resolveAuthUserProfile(result.user_uuid)

  await sendIdentityDebug("identity_link_success", {
    provider: "email",
    visitor_uuid: result.visitor_uuid,
    user_uuid: result.user_uuid,
    identity_uuid: result.identity_uuid,
    email,
    display_name: result.display_name,
    source_channel: result.source_channel,
  })
  await sendIdentityDebug("session_after_identity_link", {
    visitor_uuid: result.visitor_uuid,
    user_uuid: result.user_uuid,
    role: profile.role,
    tier: profile.tier,
    display_name: profile.display_name,
    provider: "email",
    provider_user_id: email,
    email,
    source_channel: result.source_channel,
  })

  return {
    ok: true,
    session: {
      visitor_uuid: result.visitor_uuid,
      user_uuid: result.user_uuid,
      role: profile.role,
      tier: profile.tier,
      display_name: profile.display_name,
      provider: "email",
      provider_user_id: email,
      email,
      source_channel: result.source_channel,
    },
  }
}
