import { createHmac, randomInt, timingSafeEqual } from "crypto"

import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { resolveAuthContext } from "@/core/auth/context"
import {
  resolveAuthUserProfile,
  sendIdentityDebug,
} from "@/core/auth/identity"
import { linkCurrentVisitorToIdentity, linkVisitorToIdentity } from "@/core/auth/link"
import {
  AUTH_LOGGED_OUT_COOKIE_NAME,
  authLoggedOutCookieOptions,
  resolveSession,
  VISITOR_COOKIE_NAME,
  visitorCookieOptions,
  type AppSession,
} from "@/core/auth/session"
import type { SessionRole, SessionTier, SourceChannel } from "@/core/auth/types"
import { getRestConfig, readRestError, restHeaders, restUrl } from "@/core/db/rest"
import { sendAuthDebug } from "@/core/debug"
import { sendMail } from "@/core/mail/action"
import { homePathForRole } from "@/core/auth/route"

type OtpChannel = "email" | "line" | "sms"

type OtpContext = {
  visitor_uuid: string
  user_uuid: string | null
  channel: OtpChannel
  target: string
}

type OtpRecord = {
  otp_uuid: string
  channel: OtpChannel
  target: string
  code_hash: string
  visitor_uuid: string | null
  user_uuid: string | null
  attempt_count: number
  expires_at: string
  consumed_at: string | null
  created_at: string
}

const OTP_SELECT =
  "otp_uuid,visitor_uuid,user_uuid,channel,target,code_hash,expires_at,consumed_at,attempt_count,created_at"

const OTP_MAX_ATTEMPTS = 5
const LINE_LOGIN_STATE_COOKIE = "amp_line_oauth_state"
const LINE_LOGIN_AUTHORIZE_URL = "https://access.line.me/oauth2/v2.1/authorize"
const LINE_LOGIN_TOKEN_URL = "https://api.line.me/oauth2/v2.1/token"
const LINE_PROFILE_URL = "https://api.line.me/v2/profile"
const LINE_OAUTH_STATE_COOKIE_MAX_AGE_SECONDS = 10 * 60

console.warn("[OTP_ENVIRONMENT_LOADED]", {
  has_otp_secret: Boolean(process.env.OTP_SECRET),
  node_env: process.env.NODE_ENV ?? null,
})

function appBaseUrl(request: Request) {
  const requestUrl = new URL(request.url)

  if (requestUrl.hostname === "localhost" || requestUrl.hostname === "127.0.0.1") {
    return requestUrl.origin
  }

  return (process.env.NEXT_PUBLIC_APP_URL ?? requestUrl.origin).replace(/\/$/, "")
}

type LineOAuthStateCookiePayload = {
  state: string
  visitor_uuid: string | null
  source_channel: SourceChannel
  issued_at: string
  return_to: string | null
}

function lineOAuthStateSecret() {
  return (
    process.env.OAUTH_STATE_SECRET ??
    process.env.OTP_SECRET ??
    process.env.LINE_LOGIN_CHANNEL_SECRET ??
    "amp-line-oauth-dev-secret"
  )
}

function signLineOAuthStatePayload(value: string) {
  return createHmac("sha256", lineOAuthStateSecret()).update(value).digest("base64url")
}

function encodeLineOAuthStateCookie(payload: LineOAuthStateCookiePayload) {
  const value = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url")
  return `${value}.${signLineOAuthStatePayload(value)}`
}

function parseLineOAuthStateCookie(
  value: string | null,
): LineOAuthStateCookiePayload | null {
  if (!value) {
    return null
  }

  const [payload_value, signature] = value.split(".")

  if (!payload_value || !signature) {
    return null
  }

  const expected_signature = signLineOAuthStatePayload(payload_value)
  const actual = Buffer.from(signature)
  const expected = Buffer.from(expected_signature)

  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return null
  }

  try {
    const payload = JSON.parse(
      Buffer.from(payload_value, "base64url").toString("utf8"),
    ) as Partial<LineOAuthStateCookiePayload>

    if (
      typeof payload.state === "string" &&
      payload.state &&
      (payload.visitor_uuid === null || typeof payload.visitor_uuid === "string") &&
      (payload.source_channel === "web" ||
        payload.source_channel === "pwa" ||
        payload.source_channel === "liff" ||
        payload.source_channel === "line") &&
      typeof payload.issued_at === "string"
    ) {
      return {
        state: payload.state,
        visitor_uuid: payload.visitor_uuid,
        source_channel: payload.source_channel,
        issued_at: payload.issued_at,
        return_to:
          typeof payload.return_to === "string" ? payload.return_to : null,
      }
    }
  } catch {
    return null
  }

  return null
}

function setLineOAuthStateCookie(
  response: NextResponse,
  payload: LineOAuthStateCookiePayload,
) {
  response.cookies.set(
    LINE_LOGIN_STATE_COOKIE,
    encodeLineOAuthStateCookie(payload),
    {
      httpOnly: true,
      maxAge: LINE_OAUTH_STATE_COOKIE_MAX_AGE_SECONDS,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    },
  )
}

function clearLineOAuthStateCookie(response: NextResponse) {
  response.cookies.set(LINE_LOGIN_STATE_COOKIE, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  })
}

function normalizeReturnTo(value: string | null | undefined) {
  if (!value) {
    return null
  }

  const trimmed = value.trim()

  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return null
  }

  return trimmed
}

function setAuthLoggedOutCookie(response: NextResponse) {
  response.cookies.set(AUTH_LOGGED_OUT_COOKIE_NAME, "true", authLoggedOutCookieOptions)
}

function clearAuthLoggedOutCookie(response: NextResponse) {
  response.cookies.set(AUTH_LOGGED_OUT_COOKIE_NAME, "", {
    ...authLoggedOutCookieOptions,
    maxAge: 0,
  })
}

function clearRuntimeAuthCookies(request: NextRequest, response: NextResponse) {
  for (const cookie of request.cookies.getAll()) {
    if (cookie.name === VISITOR_COOKIE_NAME) {
      continue
    }

    if (
      cookie.name === "sb-access-token" ||
      cookie.name === "sb-refresh-token" ||
      cookie.name === "supabase-auth-token" ||
      cookie.name.startsWith("sb-")
    ) {
      response.cookies.delete(cookie.name)
    }
  }
}

function normalizeLinkedRole(value: string | null | undefined): SessionRole {
  if (
    value === "admin" ||
    value === "owner" ||
    value === "concierge" ||
    value === "driver" ||
    value === "user"
  ) {
    return value
  }

  return "user"
}

function normalizeLinkedTier(value: string | null | undefined): SessionTier {
  return value?.trim() ? value : "member"
}

async function writeSessionVisitorCookie(input: {
  response: NextResponse
  visitor_uuid: string
  user_uuid: string
  pathname: string
}) {
  input.response.cookies.set(
    VISITOR_COOKIE_NAME,
    input.visitor_uuid,
    visitorCookieOptions,
  )

  await sendAuthDebug("session_cookie_write", {
    cookie_name: VISITOR_COOKIE_NAME,
    visitor_uuid: input.visitor_uuid,
    user_uuid: input.user_uuid,
    pathname: input.pathname,
    path: visitorCookieOptions.path,
    max_age: visitorCookieOptions.maxAge,
    secure: visitorCookieOptions.secure,
    same_site: visitorCookieOptions.sameSite,
  })
}

async function unlinkVisitorUser(visitor_uuid: string) {
  const config = getRestConfig()

  if (!config) {
    return
  }

  const response = await fetch(
    restUrl(config, "visitors", `visitor_uuid=eq.${encodeURIComponent(visitor_uuid)}`),
    {
      method: "PATCH",
      headers: restHeaders(config),
      body: JSON.stringify({
        user_uuid: null,
        updated_at: new Date().toISOString(),
      }),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    const error = await readRestError(response)
    throw new Error(
      `Failed to logout visitor: ${error.code ?? "unknown"} ${
        error.message ?? "No PostgREST error returned"
      }`,
    )
  }
}

export async function logoutCurrentVisitor(request: NextRequest) {
  const context = await resolveAuthContext()
  const session = await resolveSession(context)
  const response = NextResponse.redirect(new URL("/", appBaseUrl(request)), 303)

  await sendAuthDebug("logout_request_started", {
    visitor_uuid: session.visitor_uuid,
    old_user_uuid: session.user_uuid,
    source_channel: context.source_channel,
  })

  clearRuntimeAuthCookies(request, response)

  if (session.visitor_uuid) {
    await unlinkVisitorUser(session.visitor_uuid)
    await sendAuthDebug("logout_session_user_cleared", {
      visitor_uuid: session.visitor_uuid,
      old_user_uuid: session.user_uuid,
      source_channel: context.source_channel,
    })
  }

  setAuthLoggedOutCookie(response)
  await sendAuthDebug("logout_auto_restore_block_enabled", {
    visitor_uuid: session.visitor_uuid,
    old_user_uuid: session.user_uuid,
    source_channel: context.source_channel,
    cookie_name: AUTH_LOGGED_OUT_COOKIE_NAME,
    path: authLoggedOutCookieOptions.path,
    max_age: authLoggedOutCookieOptions.maxAge,
    secure: authLoggedOutCookieOptions.secure,
    same_site: authLoggedOutCookieOptions.sameSite,
  })

  await sendAuthDebug("logout_success", {
    visitor_uuid: session.visitor_uuid,
    old_user_uuid: session.user_uuid,
    source_channel: context.source_channel,
  })
  await sendAuthDebug("logout_request_success", {
    visitor_uuid: session.visitor_uuid,
    old_user_uuid: session.user_uuid,
    source_channel: context.source_channel,
  })

  return response
}

function normalize_string(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function normalize_channel(value: unknown): OtpChannel {
  if (value === "email" || value === "line" || value === "sms") {
    return value
  }

  return "email"
}

function normalize_target(channel: OtpChannel, value: unknown) {
  const target = normalize_string(value)

  if (!target) {
    return null
  }

  if (channel === "email") {
    return target.toLowerCase()
  }

  return target
}

function normalize_code(value: unknown) {
  const code = String(value ?? "")
    .trim()
    .replace(/\s+/g, "")

  return /^\d{6}$/.test(code) ? code : null
}

function normalize_otp_context(input: {
  session: AppSession
  channel?: unknown
  target: unknown
}): OtpContext {
  const channel = normalize_channel(input.channel)
  const target = normalize_target(channel, input.target)

  if (!input.session.visitor_uuid) {
    throw new Error("OTP requires visitor_uuid")
  }

  if (!target) {
    throw new Error("OTP target is required")
  }

  return {
    visitor_uuid: input.session.visitor_uuid,
    user_uuid: input.session.user_uuid,
    channel,
    target,
  }
}

function otp_filter(context: OtpContext) {
  return [
    `channel=eq.${encodeURIComponent(context.channel)}`,
    `target=eq.${encodeURIComponent(context.target)}`,
    `visitor_uuid=eq.${encodeURIComponent(context.visitor_uuid)}`,
  ].join("&")
}

function generate_otp_code() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0")
}

function otp_secret() {
  const secret = process.env.OTP_SECRET

  if (!secret) {
    throw new Error("OTP_SECRET is required")
  }

  return secret
}

function hash_otp_code(context: OtpContext, code: string) {
  return createHmac("sha256", otp_secret())
    .update([context.channel, context.target, context.visitor_uuid, code].join(":"))
    .digest("hex")
}

function safe_hash_equal(expected: string, actual: string) {
  const expectedBuffer = Buffer.from(expected, "hex")
  const actualBuffer = Buffer.from(actual, "hex")

  return (
    expectedBuffer.length === actualBuffer.length &&
    timingSafeEqual(expectedBuffer, actualBuffer)
  )
}

async function latest_otp(context: OtpContext) {
  const config = getRestConfig()

  if (!config) {
    throw new Error("Database config is missing")
  }

  const response = await fetch(
    restUrl(
      config,
      "otp",
      [
        otp_filter(context),
        "consumed_at=is.null",
        `select=${OTP_SELECT}`,
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
      `Failed to load OTP: ${error.code ?? "unknown"} ${
        error.message ?? "No PostgREST error returned"
      }`,
    )
  }

  const rows = (await response.json()) as OtpRecord[]

  return rows[0] ?? null
}

function assert_resend_allowed(record: OtpRecord | null) {
  if (!record) {
    return
  }

  const elapsed = Date.now() - new Date(record.created_at).getTime()

  if (elapsed < 60 * 1000) {
    throw new Error("Please wait before requesting a new code")
  }
}

export async function expire_otp(context: OtpContext) {
  const config = getRestConfig()

  if (!config) {
    throw new Error("Database config is missing")
  }

  const now = new Date().toISOString()
  const response = await fetch(
    restUrl(config, "otp", [otp_filter(context), "consumed_at=is.null"].join("&")),
    {
      method: "PATCH",
      headers: restHeaders(config),
      body: JSON.stringify({
        consumed_at: now,
      }),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    const error = await readRestError(response)
    throw new Error(
      `Failed to expire OTP: ${error.code ?? "unknown"} ${
        error.message ?? "No PostgREST error returned"
      }`,
    )
  }
}

export async function create_otp(context: OtpContext) {
  const config = getRestConfig()

  if (!config) {
    throw new Error("Database config is missing")
  }

  const latest = await latest_otp(context)
  assert_resend_allowed(latest)
  await expire_otp(context)

  const code = generate_otp_code()
  const expires_at = new Date(Date.now() + 10 * 60 * 1000).toISOString()
  const response = await fetch(restUrl(config, "otp", `select=${OTP_SELECT}`), {
    method: "POST",
    headers: {
      ...restHeaders(config),
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      channel: context.channel,
      target: context.target,
      code_hash: hash_otp_code(context, code),
      visitor_uuid: context.visitor_uuid,
      user_uuid: context.user_uuid,
      expires_at,
      attempt_count: 0,
    }),
    cache: "no-store",
  })

  if (!response.ok) {
    const error = await readRestError(response)
    throw new Error(
      `Failed to create OTP: ${error.code ?? "unknown"} ${
        error.message ?? "No PostgREST error returned"
      }`,
    )
  }

  const rows = (await response.json()) as OtpRecord[]

  return {
    record: rows[0],
    code,
  }
}

async function increment_attempt(record: OtpRecord) {
  const config = getRestConfig()

  if (!config) {
    throw new Error("Database config is missing")
  }

  const response = await fetch(
    restUrl(config, "otp", `otp_uuid=eq.${encodeURIComponent(record.otp_uuid)}`),
    {
      method: "PATCH",
      headers: restHeaders(config),
      body: JSON.stringify({
        attempt_count: record.attempt_count + 1,
      }),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    const error = await readRestError(response)
    throw new Error(
      `Failed to update OTP attempt: ${error.code ?? "unknown"} ${
        error.message ?? "No PostgREST error returned"
      }`,
    )
  }
}

export async function consume_otp(record: OtpRecord) {
  const config = getRestConfig()

  if (!config) {
    throw new Error("Database config is missing")
  }

  const response = await fetch(
    restUrl(config, "otp", `otp_uuid=eq.${encodeURIComponent(record.otp_uuid)}`),
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
      `Failed to consume OTP: ${error.code ?? "unknown"} ${
        error.message ?? "No PostgREST error returned"
      }`,
    )
  }
}

export async function verify_otp(context: OtpContext, code: string) {
  const record = await latest_otp(context)

  if (!record) {
    throw new Error("OTP code was not found")
  }

  if (record.consumed_at) {
    throw new Error("OTP code was already used")
  }

  if (new Date(record.expires_at).getTime() <= Date.now()) {
    await consume_otp(record)
    throw new Error("OTP code has expired")
  }

  if (record.attempt_count >= OTP_MAX_ATTEMPTS) {
    await consume_otp(record)
    throw new Error("OTP attempt limit exceeded")
  }

  if (!safe_hash_equal(hash_otp_code(context, code), record.code_hash)) {
    await increment_attempt(record)

    if (record.attempt_count + 1 >= OTP_MAX_ATTEMPTS) {
      await consume_otp(record)
    }

    throw new Error("Invalid OTP code")
  }

  await consume_otp(record)

  return record
}

function otp_email(input: { code: string }) {
  return {
    subject: "【ペットタクシーわんだにゃー】認証コード",
    text: ["認証コード", "", input.code, "", "このコードは10分で失効します。"].join("\n"),
  }
}

export async function resolve_identity(context: OtpContext) {
  if (context.channel !== "email") {
    throw new Error("Only email OTP identity is supported")
  }

  return {
    provider: "email" as const,
    provider_user_id: context.target,
    email: context.target,
    display_name: context.target,
  }
}

export async function resolve_user(identity: Awaited<ReturnType<typeof resolve_identity>>) {
  const result = await linkCurrentVisitorToIdentity(identity)
  const profile = await resolveAuthUserProfile(result.user_uuid)

  return {
    result,
    profile,
  }
}

export async function update_session(input: {
  linked: Awaited<ReturnType<typeof resolve_user>>
  identity: Awaited<ReturnType<typeof resolve_identity>>
}) {
  const session = {
    visitor_uuid: input.linked.result.visitor_uuid,
    user_uuid: input.linked.result.user_uuid,
    role: input.linked.profile.role,
    tier: input.linked.profile.tier,
    display_name: input.linked.profile.display_name,
    provider: input.identity.provider,
    provider_user_id: input.identity.provider_user_id,
    email: input.identity.email,
    source_channel: input.linked.result.source_channel,
  }

  return session
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

function statusForOtpError(error: unknown) {
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

async function readBody(request: NextRequest) {
  return (await request.json().catch(() => ({}))) as Record<string, unknown>
}

export async function sendOtpLogin(request: NextRequest) {
  try {
    const body = await readBody(request)
    const context = await resolveAuthContext()
    const session = await resolveSession(context)
    const otpContext = normalize_otp_context({
      session,
      channel: body.channel,
      target: body.target ?? body.email,
    })

    await sendIdentityDebug("otp_environment_loaded", {
      has_otp_secret: Boolean(process.env.OTP_SECRET),
      visitor_uuid: otpContext.visitor_uuid,
      user_uuid: otpContext.user_uuid,
      email: otpContext.channel === "email" ? otpContext.target : null,
      channel: otpContext.channel,
      source_channel: context.source_channel,
    })

    await sendIdentityDebug("otp_send_request", {
      channel: otpContext.channel,
      target: otpContext.target,
      visitor_uuid: otpContext.visitor_uuid,
      user_uuid: otpContext.user_uuid,
      source_channel: context.source_channel,
    })

    const issued = await create_otp(otpContext)

    if (otpContext.channel === "email") {
      await sendMail({
        to: otpContext.target,
        ...otp_email({ code: issued.code }),
      })
    }

    await sendIdentityDebug("otp_send_success", {
      channel: otpContext.channel,
      target: otpContext.target,
      visitor_uuid: otpContext.visitor_uuid,
      user_uuid: otpContext.user_uuid,
      otp_uuid: issued.record?.otp_uuid ?? null,
      expires_at: issued.record?.expires_at ?? null,
    })

    return NextResponse.json({
      ok: true,
      success: true,
    })
  } catch (error) {
    return jsonError(error, "Failed to send OTP", statusForOtpError(error))
  }
}

export async function verifyCustomOtpLogin(request: NextRequest) {
  try {
    const body = await readBody(request)
    const context = await resolveAuthContext()
    const session = await resolveSession(context)
    const otpContext = normalize_otp_context({
      session,
      channel: body.channel,
      target: body.target ?? body.email,
    })
    const code = normalize_code(body.code ?? body.token)

    await sendIdentityDebug("otp_verify_request", {
      channel: otpContext.channel,
      target: otpContext.target,
      visitor_uuid: otpContext.visitor_uuid,
      user_uuid: otpContext.user_uuid,
      source_channel: context.source_channel,
    })

    if (!code) {
      throw new Error("OTP code must be 6 digits")
    }

    await verify_otp(otpContext, code)

    const identity = await resolve_identity(otpContext)
    const linked = await resolve_user(identity)
    const runtimeSession = await update_session({ identity, linked })

    await sendIdentityDebug("otp_verify_success", {
      channel: otpContext.channel,
      target: otpContext.target,
      visitor_uuid: otpContext.visitor_uuid,
      user_uuid: runtimeSession.user_uuid,
    })

    return NextResponse.json({
      ok: true,
      success: true,
      session: runtimeSession,
    })
  } catch (error) {
    await sendIdentityDebug("otp_verify_failed", {
      reason: error instanceof Error ? error.message : String(error),
    })

    return jsonError(error, "Failed to verify OTP", statusForOtpError(error))
  }
}

export async function sendLiffAuthDebug(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const event = typeof body.event === "string" ? body.event : null

  if (
    event !== "liff_init_started" &&
    event !== "liff_login_required" &&
    event !== "liff_profile_resolved"
  ) {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  await sendAuthDebug(event, {
    provider: "line",
    source_channel: "liff",
    ...body,
  })

  return NextResponse.json({ ok: true })
}

export async function completeLiffSession(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const providerUserId =
    typeof body.provider_user_id === "string" ? body.provider_user_id : null
  const displayName =
    typeof body.display_name === "string" ? body.display_name : null
  const sourceChannel = body.source_channel === "liff" ? "liff" : "liff"

  await sendAuthDebug("liff_session_start", {
    provider: "line",
    provider_user_id: providerUserId,
    source_channel: sourceChannel,
  })

  if (!providerUserId) {
    return NextResponse.json(
      {
        ok: false,
        error: "LIFF session requires provider_user_id",
      },
      { status: 400 },
    )
  }

  const result = await linkCurrentVisitorToIdentity({
    provider: "line",
    provider_user_id: providerUserId,
    display_name: displayName,
  })

  await sendAuthDebug("liff_session_success", {
    provider: "line",
    visitor_uuid: result.visitor_uuid,
    user_uuid: result.user_uuid,
    identity_uuid: result.identity_uuid,
    provider_user_id: providerUserId,
    source_channel: result.source_channel,
  })

  return NextResponse.json({
    ok: true,
    success: true,
    session: result.session,
  })
}

function lineLoginConfig(request: NextRequest) {
  const channelId = process.env.LINE_LOGIN_CHANNEL_ID
  const channelSecret = process.env.LINE_LOGIN_CHANNEL_SECRET
  const appUrl = appBaseUrl(request)

  if (!channelId || !channelSecret) {
    throw new Error("LINE login config is missing")
  }

  return {
    channelId,
    channelSecret,
    redirectUri: `${appUrl}/api/auth/line/callback`,
  }
}

function validateLineAuthorizeUrl(input: {
  url: URL
  channelId: string
  redirectUri: string
  state: string
}) {
  if (input.url.origin + input.url.pathname !== LINE_LOGIN_AUTHORIZE_URL) {
    throw new Error("LINE authorize URL endpoint is malformed")
  }

  if (input.url.searchParams.get("response_type") !== "code") {
    throw new Error("LINE authorize URL response_type is malformed")
  }

  if (input.url.searchParams.get("client_id") !== input.channelId) {
    throw new Error("LINE authorize URL client_id is malformed")
  }

  if (input.url.searchParams.get("redirect_uri") !== input.redirectUri) {
    throw new Error("LINE authorize URL redirect_uri is malformed")
  }

  if (input.url.searchParams.get("state") !== input.state) {
    throw new Error("LINE authorize URL state is malformed")
  }

  if (input.url.searchParams.get("scope") !== "profile openid") {
    throw new Error("LINE authorize URL scope is malformed")
  }

  if (input.redirectUri.includes("liff.line.me")) {
    throw new Error("LINE authorize URL must not use LIFF URL as callback")
  }
}

function buildLineAuthorizeUrl(input: {
  channelId: string
  redirectUri: string
  state: string
}) {
  const url = new URL(LINE_LOGIN_AUTHORIZE_URL)

  url.searchParams.set("response_type", "code")
  url.searchParams.set("client_id", input.channelId)
  url.searchParams.set("redirect_uri", input.redirectUri)
  url.searchParams.set("state", input.state)
  url.searchParams.set("scope", "profile openid")

  validateLineAuthorizeUrl({
    url,
    channelId: input.channelId,
    redirectUri: input.redirectUri,
    state: input.state,
  })

  return url
}

function isUuid(value: string | null) {
  return Boolean(
    value &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value,
      ),
  )
}

type LineBridgeStatePayload = {
  bridge_uuid: string
  oauth_state: string
  source_channel: "pwa"
}

function encodeLineBridgeState(payload: LineBridgeStatePayload) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url")
}

function parseLineBridgeState(value: string | null): LineBridgeStatePayload | null {
  if (!value) {
    return null
  }

  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as {
      bridge_uuid?: unknown
      oauth_state?: unknown
      source_channel?: unknown
    }

    if (
      typeof parsed.bridge_uuid === "string" &&
      isUuid(parsed.bridge_uuid) &&
      typeof parsed.oauth_state === "string" &&
      parsed.oauth_state &&
      parsed.source_channel === "pwa"
    ) {
      return {
        bridge_uuid: parsed.bridge_uuid,
        oauth_state: parsed.oauth_state,
        source_channel: "pwa",
      }
    }
  } catch {
    return null
  }

  return null
}

function lineBridgeContext(input: { visitor_uuid: string; oauth_state: string }) {
  return {
    visitor_uuid: input.visitor_uuid,
    user_uuid: null,
    channel: "line" as const,
    target: input.oauth_state,
  }
}

function hashLineBridgeState(input: { visitor_uuid: string; oauth_state: string }) {
  return hash_otp_code(lineBridgeContext(input), input.oauth_state)
}

async function loadLoginBridge(bridge_uuid: string) {
  const config = getRestConfig()

  if (!config) {
    throw new Error("Database config is missing")
  }

  const response = await fetch(
    restUrl(
      config,
      "otp",
      [
        `otp_uuid=eq.${encodeURIComponent(bridge_uuid)}`,
        `select=${OTP_SELECT}`,
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
      `Failed to load LINE bridge OTP: ${error.code ?? "unknown"} ${
        error.message ?? "No PostgREST error returned"
      }`,
    )
  }

  const rows = (await response.json()) as OtpRecord[]

  return rows[0] ?? null
}

async function patchLoginBridge(
  bridge_uuid: string,
  payload: Partial<Pick<OtpRecord, "user_uuid" | "consumed_at" | "attempt_count">>,
) {
  const config = getRestConfig()

  if (!config) {
    throw new Error("Database config is missing")
  }

  const response = await fetch(
    restUrl(config, "otp", `otp_uuid=eq.${encodeURIComponent(bridge_uuid)}`),
    {
      method: "PATCH",
      headers: restHeaders(config),
      body: JSON.stringify(payload),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    const error = await readRestError(response)
    throw new Error(
      `Failed to update LINE bridge OTP: ${error.code ?? "unknown"} ${
        error.message ?? "No PostgREST error returned"
      }`,
    )
  }
}

async function createLoginBridge(input: {
  visitor_uuid: string
  user_uuid: string | null
  source_channel: string
}) {
  const config = getRestConfig()

  if (!config) {
    throw new Error("Database config is missing")
  }

  const expires_at = new Date(Date.now() + 10 * 60 * 1000).toISOString()
  const oauth_state = crypto.randomUUID()

  await sendIdentityDebug("bridge_insert_start", {
    provider: "line",
    visitor_uuid: input.visitor_uuid,
    user_uuid: input.user_uuid,
    source_channel: input.source_channel,
    expires_at,
  })

  const response = await fetch(
    restUrl(config, "otp", `select=${OTP_SELECT}`),
    {
      method: "POST",
      headers: {
        ...restHeaders(config),
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        visitor_uuid: input.visitor_uuid,
        user_uuid: null,
        channel: "line",
        target: oauth_state,
        code_hash: hashLineBridgeState({
          visitor_uuid: input.visitor_uuid,
          oauth_state,
        }),
        expires_at,
        consumed_at: null,
        attempt_count: 0,
      }),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    const error = await readRestError(response)
    throw new Error(
      `Failed to create LINE bridge OTP: ${error.code ?? "unknown"} ${
        error.message ?? "No PostgREST error returned"
      }`,
    )
  }

  const rows = (await response.json()) as OtpRecord[]
  const bridge = rows[0]

  if (!bridge?.otp_uuid) {
    throw new Error("LINE bridge OTP creation did not return otp_uuid")
  }

  await sendIdentityDebug("bridge_insert_success", {
    provider: "line",
    bridge_uuid: bridge.otp_uuid,
    visitor_uuid: bridge.visitor_uuid,
    user_uuid: bridge.user_uuid,
    source_channel: input.source_channel,
    expires_at: bridge.expires_at,
  })

  return {
    ...bridge,
    bridge_uuid: bridge.otp_uuid,
    oauth_state,
    source_channel: input.source_channel,
  }
}

function bridgeAuthErrorPage() {
  return new NextResponse(
    [
      "<!doctype html>",
      '<html lang="ja">',
      "<head>",
      '<meta charset="utf-8" />',
      '<meta name="viewport" content="width=device-width,initial-scale=1" />',
      "<title>認証に失敗しました</title>",
      "<style>",
      "body{margin:0;background:#fdfaf6;color:#111;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;}",
      ".wrap{min-height:100dvh;display:grid;place-items:center;padding:28px;box-sizing:border-box;}",
      ".panel{width:min(100%,420px);border:1px solid #e5e5e5;border-radius:24px;background:#fff;padding:28px 22px;text-align:center;box-shadow:0 18px 50px rgba(0,0,0,.10);}",
      "h1{margin:0 0 12px;font-size:24px;line-height:1.4;letter-spacing:0;font-weight:800;}",
      "p{margin:0;color:#555;font-size:15px;line-height:1.8;font-weight:600;}",
      "</style>",
      "</head>",
      "<body>",
      '<main class="wrap">',
      '<section class="panel">',
      "<h1>認証に失敗しました</h1>",
      "<p>アプリへ戻って再度お試しください</p>",
      "</section>",
      "</main>",
      "</body>",
      "</html>",
    ].join(""),
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    },
  )
}

function bridgeCompletePage() {
  return new NextResponse(
    [
      "<!doctype html>",
      '<html lang="ja">',
      "<head>",
      '<meta charset="utf-8" />',
      '<meta name="viewport" content="width=device-width,initial-scale=1" />',
      "<title>認証しました</title>",
      "<style>",
      "body{margin:0;background:#fdfaf6;color:#111;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;}",
      ".wrap{min-height:100dvh;display:grid;place-items:center;padding:28px;box-sizing:border-box;}",
      ".panel{width:min(100%,420px);border:1px solid #e5e5e5;border-radius:24px;background:#fff;padding:28px 22px;text-align:center;box-shadow:0 18px 50px rgba(0,0,0,.10);}",
      "h1{margin:0 0 12px;font-size:24px;line-height:1.4;letter-spacing:0;font-weight:800;}",
      "p{margin:0;color:#555;font-size:15px;line-height:1.8;font-weight:600;}",
      "</style>",
      "</head>",
      "<body>",
      '<main class="wrap">',
      '<section class="panel">',
      "<h1>認証しました</h1>",
      "<p>アプリへ戻ってください</p>",
      "</section>",
      "</main>",
      "<script>",
      "window.setTimeout(function(){try{window.close()}catch(e){}},3000)",
      "</script>",
      "</body>",
      "</html>",
    ].join(""),
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    },
  )
}

export async function startLoginBridge(request: NextRequest) {
  try {
    await sendIdentityDebug("bridge_start_api_enter", {
      provider: "line",
      pathname: new URL(request.url).pathname,
    })

    const body = await readBody(request)
    const context = await resolveAuthContext()
    const session = await resolveSession(context)
    const source_channel = body.source_channel === "pwa" ? "pwa" : context.source_channel
    const config = lineLoginConfig(request)

    await sendIdentityDebug("bridge_start_context_resolved", {
      provider: "line",
      visitor_uuid: session.visitor_uuid,
      user_uuid: session.user_uuid,
      source_channel,
    })

    await sendIdentityDebug("bridge_start_request", {
      provider: "line",
      visitor_uuid: session.visitor_uuid,
      user_uuid: session.user_uuid,
      source_channel,
    })

    if (!session.visitor_uuid) {
      throw new Error("Login bridge requires visitor_uuid")
    }

    await sendIdentityDebug("bridge_start_insert_attempt", {
      provider: "line",
      visitor_uuid: session.visitor_uuid,
      user_uuid: session.user_uuid,
      source_channel,
    })

    const bridge = await createLoginBridge({
      visitor_uuid: session.visitor_uuid,
      user_uuid: session.user_uuid,
      source_channel,
    })

    await sendIdentityDebug("bridge_start_insert_success", {
      provider: "line",
      bridge_uuid: bridge.bridge_uuid,
      visitor_uuid: bridge.visitor_uuid,
      user_uuid: bridge.user_uuid,
      source_channel: bridge.source_channel,
    })

    const state = encodeLineBridgeState({
      bridge_uuid: bridge.bridge_uuid,
      oauth_state: bridge.oauth_state,
      source_channel: "pwa",
    })
    const authorizeUrl = buildLineAuthorizeUrl({
      channelId: config.channelId,
      redirectUri: config.redirectUri,
      state,
    })

    await sendIdentityDebug("bridge_start_authorize_url_created", {
      provider: "line",
      bridge_uuid: bridge.bridge_uuid,
      visitor_uuid: bridge.visitor_uuid,
      source_channel: bridge.source_channel,
      authorize_url: authorizeUrl.toString(),
    })

    await sendIdentityDebug("bridge_start", {
      provider: "line",
      bridge_uuid: bridge.bridge_uuid,
      visitor_uuid: bridge.visitor_uuid,
      user_uuid: bridge.user_uuid,
      source_channel: bridge.source_channel,
      expires_at: bridge.expires_at,
    })
    await sendIdentityDebug("bridge_state_created", {
      provider: "line",
      bridge_uuid: bridge.bridge_uuid,
      visitor_uuid: bridge.visitor_uuid,
      source_channel: bridge.source_channel,
    })
    await sendIdentityDebug("line_oauth_authorize_url", {
      provider: "line",
      bridge_uuid: bridge.bridge_uuid,
      visitor_uuid: bridge.visitor_uuid,
      user_uuid: bridge.user_uuid,
      source_channel: bridge.source_channel,
      channel_id: config.channelId,
      redirect_uri: config.redirectUri,
      expected_redirect_uri: "https://app.da-nya.com/api/auth/line/callback",
      callback_matches_expected:
        config.redirectUri === "https://app.da-nya.com/api/auth/line/callback",
      liff_callback_detected: config.redirectUri.includes("liff.line.me"),
      state,
      authorize_url: authorizeUrl.toString(),
    })
    await sendIdentityDebug("bridge_authorize_url_created", {
      provider: "line",
      bridge_uuid: bridge.bridge_uuid,
      visitor_uuid: bridge.visitor_uuid,
      source_channel: bridge.source_channel,
      authorize_url: authorizeUrl.toString(),
    })
    await sendIdentityDebug("bridge_start_response", {
      provider: "line",
      bridge_uuid: bridge.bridge_uuid,
      visitor_uuid: bridge.visitor_uuid,
      user_uuid: bridge.user_uuid,
      source_channel: bridge.source_channel,
      authorize_url_exists: true,
    })
    await sendIdentityDebug("bridge_start_api_response", {
      provider: "line",
      bridge_uuid: bridge.bridge_uuid,
      visitor_uuid: bridge.visitor_uuid,
      user_uuid: bridge.user_uuid,
      source_channel: bridge.source_channel,
      authorize_url: authorizeUrl.toString(),
    })

    const response = NextResponse.json({
      ok: true,
      bridge_uuid: bridge.bridge_uuid,
      authorize_url: authorizeUrl.toString(),
    })
    clearAuthLoggedOutCookie(response)
    await sendAuthDebug("login_cleared_logout_block", {
      provider: "line",
      bridge_uuid: bridge.bridge_uuid,
      visitor_uuid: bridge.visitor_uuid,
      user_uuid: bridge.user_uuid,
      source_channel: bridge.source_channel,
      cookie_name: AUTH_LOGGED_OUT_COOKIE_NAME,
    })

    return response
  } catch (error) {
    await sendIdentityDebug("bridge_start_api_failed", {
      provider: "line",
      error_message: error instanceof Error ? error.message : String(error),
    })

    return jsonError(error, "Failed to start login bridge", 500)
  }
}

export async function getLoginBridgeStatus(request: NextRequest) {
  try {
    const context = await resolveAuthContext()
    const session = await resolveSession(context)
    const requestUrl = new URL(request.url)
    const bridge_uuid = requestUrl.searchParams.get("bridge_uuid")

    if (!bridge_uuid || !isUuid(bridge_uuid)) {
      return NextResponse.json({ ok: false, status: "failed" }, { status: 400 })
    }

    const bridge = await loadLoginBridge(bridge_uuid)

    if (!bridge || !bridge.visitor_uuid || bridge.visitor_uuid !== session.visitor_uuid) {
      return NextResponse.json({ ok: false, status: "failed" }, { status: 404 })
    }

    if (new Date(bridge.expires_at).getTime() <= Date.now() && !bridge.consumed_at) {
      return NextResponse.json({
        ok: true,
        status: "expired",
      })
    }

    if (!bridge.consumed_at) {
      await sendIdentityDebug("bridge_poll_pending", {
        provider: "line",
        bridge_uuid: bridge.otp_uuid,
        visitor_uuid: bridge.visitor_uuid,
        source_channel: "pwa",
      })
    }

    if (bridge.consumed_at && bridge.user_uuid) {
      const profile = await resolveAuthUserProfile(bridge.user_uuid)
      const route_path = homePathForRole(normalizeLinkedRole(profile.role))

      await sendIdentityDebug("bridge_poll_success", {
        provider: "line",
        bridge_uuid: bridge.otp_uuid,
        visitor_uuid: bridge.visitor_uuid,
        user_uuid: bridge.user_uuid,
        source_channel: "pwa",
      })
      await sendIdentityDebug("pwa_session_restored", {
        provider: "line",
        bridge_uuid: bridge.otp_uuid,
        visitor_uuid: bridge.visitor_uuid,
        user_uuid: bridge.user_uuid,
        source_channel: "pwa",
      })
      await sendIdentityDebug("pwa_bridge_poll_success", {
        provider: "line",
        bridge_uuid: bridge.otp_uuid,
        visitor_uuid: bridge.visitor_uuid,
        user_uuid: bridge.user_uuid,
        route_path,
        source_channel: "pwa",
      })

      const response = NextResponse.json({
        ok: true,
        success: true,
        status: "success",
        route: {
          path: route_path,
        },
        session: {
          visitor_uuid: bridge.visitor_uuid,
          user_uuid: bridge.user_uuid,
          role: profile.role,
          tier: profile.tier,
          display_name: profile.display_name,
          provider: profile.provider,
          email: profile.email,
          source_channel: "pwa",
        },
      })
      await writeSessionVisitorCookie({
        response,
        visitor_uuid: bridge.visitor_uuid,
        user_uuid: bridge.user_uuid,
        pathname: "/api/auth/bridge/status",
      })

      return response
    }

    return NextResponse.json({
      ok: true,
      status: "pending",
    })
  } catch (error) {
    return jsonError(error, "Failed to get login bridge status", 500)
  }
}

export async function sendLoginBridgeDebug(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const event = typeof body.event === "string" ? body.event : null

  if (
    event !== "bridge_polling_started" &&
    event !== "pwa_login_focus_check" &&
    event !== "pwa_login_pageshow_check" &&
    event !== "pwa_login_pending_set" &&
    event !== "line_login_button_clicked" &&
    event !== "pwa_bridge_fetch_failed" &&
    event !== "pwa_bridge_fetch_response" &&
    event !== "pwa_bridge_fetch_started" &&
    event !== "pwa_bridge_fetch_timeout" &&
    event !== "pwa_bridge_start_request" &&
    event !== "pwa_launch_entered" &&
    event !== "pwa_bridge_start_failed" &&
    event !== "pwa_bridge_start_success" &&
    event !== "pwa_bridge_location_replace_called" &&
    event !== "pwa_bridge_redirect_route_resolved" &&
    event !== "pwa_line_popup_blocked" &&
    event !== "pwa_line_popup_opened" &&
    event !== "pwa_line_popup_redirected" &&
    event !== "pwa_login_polling_authenticated" &&
    event !== "pwa_login_polling_started" &&
    event !== "pwa_login_polling_tick" &&
    event !== "pwa_login_polling_timeout" &&
    event !== "pwa_login_polling_user_found" &&
    event !== "pwa_login_redirect_pending" &&
    event !== "pwa_login_reload_triggered" &&
    event !== "pwa_login_route_resolved" &&
    event !== "pwa_login_redirect_complete" &&
    event !== "pwa_login_redirect_start" &&
    event !== "pwa_login_location_replace_called" &&
    event !== "pwa_popup_connecting_page_failed" &&
    event !== "pwa_popup_connecting_page_written" &&
    event !== "pwa_login_redirect_fallback_reload" &&
    event !== "pwa_login_success_modal_shown" &&
    event !== "pwa_login_success_ui_shown" &&
    event !== "pwa_popup_close_attempted" &&
    event !== "pwa_popup_close_failed" &&
    event !== "pwa_reload_after_bridge" &&
    event !== "pwa_session_refresh_failed" &&
    event !== "pwa_session_refresh_success" &&
    event !== "pwa_waiting_ui_shown"
  ) {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  await sendIdentityDebug(event, {
    provider: "line",
    source_channel: "pwa",
    ...body,
  })

  return NextResponse.json({ ok: true })
}

export async function startLineLogin(request: NextRequest) {
  try {
    const context = await resolveAuthContext()
    const session = await resolveSession(context)
    const requestUrl = new URL(request.url)
    const bridge_uuid = requestUrl.searchParams.get("bridge_uuid")
    const return_to = normalizeReturnTo(requestUrl.searchParams.get("return_to"))

    const config = lineLoginConfig(request)
    const bridge =
      bridge_uuid && isUuid(bridge_uuid) ? await loadLoginBridge(bridge_uuid) : null

    if (bridge_uuid && !bridge) {
      throw new Error("Login bridge was not found")
    }

    if (bridge && bridge.consumed_at) {
      throw new Error("Login bridge is not pending")
    }

    const bridge_state = bridge
      ? encodeLineBridgeState({
          bridge_uuid: bridge.otp_uuid,
          oauth_state: bridge.target,
          source_channel: "pwa",
        })
      : null
    const state = bridge_state ?? crypto.randomUUID()
    const url = buildLineAuthorizeUrl({
      channelId: config.channelId,
      redirectUri: config.redirectUri,
      state,
    })

    await sendIdentityDebug("line_oauth_authorize_url", {
      provider: "line",
      bridge_uuid: bridge?.otp_uuid ?? null,
      visitor_uuid: session.visitor_uuid,
      user_uuid: session.user_uuid,
      source_channel: bridge ? "pwa" : context.source_channel,
      channel_id: config.channelId,
      redirect_uri: config.redirectUri,
      return_to,
      expected_redirect_uri: "https://app.da-nya.com/api/auth/line/callback",
      callback_matches_expected:
        config.redirectUri === "https://app.da-nya.com/api/auth/line/callback",
      liff_callback_detected: config.redirectUri.includes("liff.line.me"),
      state,
      authorize_url: url.toString(),
    })
    await sendIdentityDebug("line_oauth_redirect_start", {
      provider: "line",
      bridge_uuid: bridge?.otp_uuid ?? null,
      visitor_uuid: session.visitor_uuid,
      user_uuid: session.user_uuid,
      source_channel: bridge ? "pwa" : context.source_channel,
      final_url: url.toString(),
      return_to,
    })

    const response = NextResponse.redirect(url, 303)
    clearAuthLoggedOutCookie(response)
    await sendAuthDebug("login_cleared_logout_block", {
      provider: "line",
      bridge_uuid: bridge?.otp_uuid ?? null,
      visitor_uuid: session.visitor_uuid,
      user_uuid: session.user_uuid,
      source_channel: bridge ? "pwa" : context.source_channel,
      cookie_name: AUTH_LOGGED_OUT_COOKIE_NAME,
    })

    setLineOAuthStateCookie(response, {
      state,
      visitor_uuid: session.visitor_uuid,
      source_channel: bridge ? "pwa" : context.source_channel,
      issued_at: new Date().toISOString(),
      return_to,
    })

    await sendIdentityDebug("oauth_state_saved_cookie", {
      provider: "line",
      bridge_uuid: bridge?.otp_uuid ?? null,
      visitor_uuid: session.visitor_uuid,
      user_uuid: session.user_uuid,
      source_channel: bridge ? "pwa" : context.source_channel,
      path: "/",
      same_site: "lax",
      secure: process.env.NODE_ENV === "production",
      state_exists: Boolean(state),
      return_to,
    })

    await sendIdentityDebug("line_oauth_started", {
      provider: "line",
      bridge_uuid: bridge?.otp_uuid ?? null,
      visitor_uuid: session.visitor_uuid,
      user_uuid: session.user_uuid,
      source_channel: bridge ? "pwa" : context.source_channel,
      redirect_uri: config.redirectUri,
      return_to,
    })
    await sendIdentityDebug("line_oauth_redirect_complete", {
      provider: "line",
      bridge_uuid: bridge?.otp_uuid ?? null,
      visitor_uuid: session.visitor_uuid,
      user_uuid: session.user_uuid,
      source_channel: bridge ? "pwa" : context.source_channel,
      final_url: url.toString(),
      return_to,
    })

    return response
  } catch (error) {
    return jsonError(error, "Failed to start LINE login", 500)
  }
}

async function exchangeLineCode(input: {
  code: string
  redirectUri: string
  channelId: string
  channelSecret: string
}) {
  const response = await fetch(LINE_LOGIN_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: input.code,
      redirect_uri: input.redirectUri,
      client_id: input.channelId,
      client_secret: input.channelSecret,
    }),
    cache: "no-store",
  })
  const data = (await response.json().catch(() => ({}))) as {
    access_token?: string
    id_token?: string
    error?: string
    error_description?: string
  }

  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description ?? data.error ?? "LINE token exchange failed")
  }

  return {
    access_token: data.access_token,
    id_token: data.id_token ?? null,
  }
}

async function fetchLineProfile(accessToken: string) {
  const response = await fetch(LINE_PROFILE_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  })
  const profile = (await response.json().catch(() => ({}))) as {
    userId?: string
    displayName?: string
    pictureUrl?: string
  }

  if (!response.ok || !profile.userId) {
    throw new Error("LINE profile resolve failed")
  }

  return profile
}

async function completeLineBridge(input: {
  bridge: OtpRecord
  oauth_state: string
  profile: Awaited<ReturnType<typeof fetchLineProfile>>
}) {
  if (input.bridge.channel !== "line") {
    throw new Error("Login bridge channel is invalid")
  }

  if (input.bridge.consumed_at) {
    throw new Error("Login bridge is not pending")
  }

  if (new Date(input.bridge.expires_at).getTime() <= Date.now()) {
    throw new Error("Login bridge has expired")
  }

  if (
    !input.bridge.visitor_uuid ||
    hashLineBridgeState({
      visitor_uuid: input.bridge.visitor_uuid,
      oauth_state: input.oauth_state,
    }) !== input.bridge.code_hash
  ) {
    await patchLoginBridge(input.bridge.otp_uuid, {
      attempt_count: input.bridge.attempt_count + 1,
    })
    throw new Error("LINE bridge OAuth state mismatch")
  }

  const result = await linkVisitorToIdentity(
    {
      provider: "line",
      provider_user_id: input.profile.userId,
      display_name: input.profile.displayName ?? null,
      image_url: input.profile.pictureUrl ?? null,
    },
    {
      visitor_uuid: input.bridge.visitor_uuid,
      current_user_uuid: input.bridge.user_uuid,
      source_channel: "pwa",
    },
  )

  await patchLoginBridge(input.bridge.otp_uuid, {
    user_uuid: result.user_uuid,
    consumed_at: new Date().toISOString(),
  })

  await sendIdentityDebug("bridge_completed", {
    provider: "line",
    bridge_uuid: input.bridge.otp_uuid,
    visitor_uuid: input.bridge.visitor_uuid,
    user_uuid: result.user_uuid,
    identity_uuid: result.identity_uuid,
    provider_user_id: input.profile.userId,
    source_channel: "pwa",
  })

  await sendIdentityDebug("line_identity_link_success", {
    provider: "line",
    bridge_uuid: input.bridge.otp_uuid,
    visitor_uuid: result.visitor_uuid,
    user_uuid: result.user_uuid,
    identity_uuid: result.identity_uuid,
    provider_user_id: input.profile.userId,
    display_name: input.profile.displayName ?? null,
    source_channel: result.source_channel,
  })

  return result
}

async function completeLineBridgeOAuthCallback(
  request: NextRequest,
  bridgeStatePayload: LineBridgeStatePayload,
  params: {
    code: string | null
    state: string | null
    error: string | null
    errorDescription: string | null
  },
) {
  const config = lineLoginConfig(request)
  let callbackBridge: OtpRecord | null = null

  await sendIdentityDebug("line_oauth_callback_received", {
    provider: "line",
    bridge_uuid: bridgeStatePayload.bridge_uuid,
    visitor_uuid: null,
    user_uuid: null,
    source_channel: bridgeStatePayload.source_channel,
    code_exists: Boolean(params.code),
    state_exists: Boolean(params.state),
    error: params.error,
    error_description: params.errorDescription,
  })

  try {
    callbackBridge = await loadLoginBridge(bridgeStatePayload.bridge_uuid)

    await sendIdentityDebug("browser_bridge_callback_detected", {
      provider: "line",
      bridge_uuid: bridgeStatePayload.bridge_uuid,
      visitor_uuid: callbackBridge?.visitor_uuid ?? null,
      source_channel: bridgeStatePayload.source_channel,
    })
    await sendIdentityDebug("line_callback_bridge_detected", {
      provider: "line",
      bridge_uuid: bridgeStatePayload.bridge_uuid,
      visitor_uuid: callbackBridge?.visitor_uuid ?? null,
      source_channel: bridgeStatePayload.source_channel,
    })

    if (!callbackBridge) {
      throw new Error("Login bridge was not found")
    }

    if (
      callbackBridge.channel !== "line" ||
      callbackBridge.consumed_at ||
      new Date(callbackBridge.expires_at).getTime() <= Date.now() ||
      !callbackBridge.visitor_uuid ||
      hashLineBridgeState({
        visitor_uuid: callbackBridge.visitor_uuid,
        oauth_state: bridgeStatePayload.oauth_state,
      }) !== callbackBridge.code_hash
    ) {
      throw new Error("LINE bridge OAuth state mismatch")
    }

    await sendIdentityDebug("bridge_state_valid", {
      provider: "line",
      bridge_uuid: callbackBridge.otp_uuid,
      visitor_uuid: callbackBridge.visitor_uuid,
      source_channel: "pwa",
    })

    if (params.error) {
      await patchLoginBridge(callbackBridge.otp_uuid, {
        attempt_count: callbackBridge.attempt_count + 1,
      })
      throw new Error(params.errorDescription ?? params.error)
    }

    if (!params.code || !params.state) {
      throw new Error("LINE OAuth state mismatch")
    }

    const token = await exchangeLineCode({
      code: params.code,
      redirectUri: config.redirectUri,
      channelId: config.channelId,
      channelSecret: config.channelSecret,
    })
    const profile = await fetchLineProfile(token.access_token)

    const bridgeResult = await completeLineBridge({
      bridge: callbackBridge,
      oauth_state: bridgeStatePayload.oauth_state,
      profile,
    })

    await sendIdentityDebug("browser_bridge_completed", {
      provider: "line",
      bridge_uuid: callbackBridge.otp_uuid,
      visitor_uuid: callbackBridge.visitor_uuid,
      user_uuid: bridgeResult.user_uuid,
      source_channel: "pwa",
    })
    await sendIdentityDebug("bridge_callback_complete_page_shown", {
      provider: "line",
      bridge_uuid: callbackBridge.otp_uuid,
      visitor_uuid: callbackBridge.visitor_uuid,
      user_uuid: callbackBridge.user_uuid,
      source_channel: "pwa",
    })
    await sendIdentityDebug("callback_return_to_app_screen_rendered", {
      provider: "line",
      bridge_uuid: callbackBridge.otp_uuid,
      visitor_uuid: callbackBridge.visitor_uuid,
      user_uuid: bridgeResult.user_uuid,
      source_channel: "pwa",
    })
    await sendIdentityDebug("browser_return_to_pwa_message_shown", {
      provider: "line",
      bridge_uuid: callbackBridge.otp_uuid,
      visitor_uuid: callbackBridge.visitor_uuid,
      user_uuid: bridgeResult.user_uuid,
      source_channel: "pwa",
    })

    const response = bridgeCompletePage()
    clearLineOAuthStateCookie(response)
    clearAuthLoggedOutCookie(response)

    return response
  } catch (callbackError) {
    if (callbackBridge && !callbackBridge.consumed_at) {
      await patchLoginBridge(callbackBridge.otp_uuid, {
        attempt_count: callbackBridge.attempt_count + 1,
      }).catch(() => null)
    }

    await sendIdentityDebug("identity_link_failed", {
      provider: "line",
      bridge_uuid: bridgeStatePayload.bridge_uuid,
      visitor_uuid: callbackBridge?.visitor_uuid ?? null,
      user_uuid: callbackBridge?.user_uuid ?? null,
      reason: "line_bridge_oauth_failed",
      error: callbackError instanceof Error ? callbackError.message : String(callbackError),
      source_channel: "pwa",
    })

    return bridgeAuthErrorPage()
  }
}

export async function completeLineLogin(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")
  const state = requestUrl.searchParams.get("state")
  const error = requestUrl.searchParams.get("error")
  const errorDescription = requestUrl.searchParams.get("error_description")
  const bridgeStatePayload = parseLineBridgeState(state)

  if (bridgeStatePayload) {
    return completeLineBridgeOAuthCallback(request, bridgeStatePayload, {
      code,
      state,
      error,
      errorDescription,
    })
  }

  const context = await resolveAuthContext()
  const config = lineLoginConfig(request)
  const rawCookieState = request.cookies.get(LINE_LOGIN_STATE_COOKIE)?.value ?? null
  const cookieState = parseLineOAuthStateCookie(rawCookieState)
  const failureUrl = new URL("/", appBaseUrl(request))
  let session: AppSession | null = null

  if (cookieState) {
    await sendIdentityDebug("oauth_state_cookie_found", {
      provider: "line",
      visitor_uuid: cookieState.visitor_uuid,
      source_channel: cookieState.source_channel,
      issued_at: cookieState.issued_at,
      return_to: cookieState.return_to,
      state_exists: true,
    })
  } else {
    await sendIdentityDebug("oauth_state_cookie_missing", {
      provider: "line",
      raw_cookie_exists: Boolean(rawCookieState),
      source_channel: context.source_channel,
    })
  }

  await sendIdentityDebug("line_oauth_callback_received", {
    provider: "line",
    bridge_uuid: null,
    visitor_uuid: cookieState?.visitor_uuid ?? null,
    user_uuid: null,
    source_channel: context.source_channel,
    code_exists: Boolean(code),
    state_exists: Boolean(state),
    error,
    error_description: errorDescription,
  })

  try {
    if (error) {
      throw new Error(errorDescription ?? error)
    }

    if (!code || !state) {
      throw new Error("LINE OAuth state mismatch")
    }

    if (!cookieState) {
      await sendIdentityDebug("oauth_state_compare_failed", {
        provider: "line",
        reason: rawCookieState ? "invalid_cookie" : "missing_cookie",
        callback_state_exists: Boolean(state),
        source_channel: context.source_channel,
      })
      throw new Error("LINE OAuth state mismatch")
    }

    if (state !== cookieState.state) {
      await sendIdentityDebug("oauth_state_compare_failed", {
        provider: "line",
        reason: "state_mismatch",
        visitor_uuid: cookieState.visitor_uuid,
        callback_state_exists: Boolean(state),
        cookie_state_exists: Boolean(cookieState.state),
        source_channel: cookieState.source_channel,
      })
      throw new Error("LINE OAuth state mismatch")
    }

    await sendIdentityDebug("oauth_state_compare_success", {
      provider: "line",
      visitor_uuid: cookieState.visitor_uuid,
      source_channel: cookieState.source_channel,
      callback_state_exists: Boolean(state),
    })

    const token = await exchangeLineCode({
      code,
      redirectUri: config.redirectUri,
      channelId: config.channelId,
      channelSecret: config.channelSecret,
    })
    const profile = await fetchLineProfile(token.access_token)

    session = await resolveSession(context)
    const callbackVisitorUuid = cookieState.visitor_uuid ?? session.visitor_uuid

    if (!callbackVisitorUuid) {
      throw new Error("LINE OAuth visitor cookie missing")
    }

    const result = await linkVisitorToIdentity(
      {
        provider: "line",
        provider_user_id: profile.userId,
        display_name: profile.displayName ?? null,
        image_url: profile.pictureUrl ?? null,
      },
      {
        visitor_uuid: callbackVisitorUuid,
        current_user_uuid: session.user_uuid,
        source_channel: cookieState.source_channel,
        locale: context.locale,
        session: {
          ...session,
          visitor_uuid: callbackVisitorUuid,
          source_channel: cookieState.source_channel as AppSession["source_channel"],
        },
      },
    )

    await sendIdentityDebug("line_callback_user_resolved", {
      provider: "line",
      visitor_uuid: result.visitor_uuid,
      user_uuid: result.user_uuid,
      identity_uuid: result.identity_uuid,
      provider_user_id: profile.userId,
      source_channel: result.source_channel,
    })

    await sendIdentityDebug("line_identity_link_success", {
      provider: "line",
      visitor_uuid: result.visitor_uuid,
      user_uuid: result.user_uuid,
      identity_uuid: result.identity_uuid,
      provider_user_id: profile.userId,
      display_name: profile.displayName ?? null,
      source_channel: result.source_channel,
    })

    const linkedProfile = await resolveAuthUserProfile(result.user_uuid)
    const linkedSession: AppSession = {
      ...result.session,
      visitor_uuid: result.visitor_uuid,
      user_uuid: result.user_uuid,
      role: normalizeLinkedRole(linkedProfile.role),
      tier: normalizeLinkedTier(linkedProfile.tier),
      display_name: linkedProfile.display_name ?? result.display_name,
      image_url: linkedProfile.image_url,
      provider: linkedProfile.provider ?? "line",
      provider_user_id: linkedProfile.provider_user_id ?? profile.userId ?? null,
      email: linkedProfile.email,
      source_channel: result.source_channel as AppSession["source_channel"],
      can_logout: true,
      can_start_line_oauth: false,
    }

    await sendAuthDebug("resolved_user_uuid", {
      provider: "line",
      visitor_uuid: result.visitor_uuid,
      user_uuid: linkedSession.user_uuid,
      pathname: "/api/auth/line/callback",
    })
    await sendAuthDebug("resolved_role", {
      provider: "line",
      visitor_uuid: result.visitor_uuid,
      user_uuid: linkedSession.user_uuid,
      role: linkedSession.role,
      pathname: "/api/auth/line/callback",
    })
    await sendAuthDebug("resolved_tier", {
      provider: "line",
      visitor_uuid: result.visitor_uuid,
      user_uuid: linkedSession.user_uuid,
      tier: linkedSession.tier,
      pathname: "/api/auth/line/callback",
    })

    await sendIdentityDebug("line_callback_redirect", {
      provider: "line",
      visitor_uuid: result.visitor_uuid,
      user_uuid: result.user_uuid,
      source_channel: result.source_channel,
      redirect_path: cookieState.return_to ?? "/",
    })

    const response = NextResponse.redirect(
      new URL(cookieState.return_to ?? "/", appBaseUrl(request)),
      303,
    )
    await writeSessionVisitorCookie({
      response,
      visitor_uuid: result.visitor_uuid,
      user_uuid: result.user_uuid,
      pathname: "/api/auth/line/callback",
    })
    clearLineOAuthStateCookie(response)
    clearAuthLoggedOutCookie(response)

    return response
  } catch (callbackError) {
    failureUrl.searchParams.set("auth_error", "line")
    await sendIdentityDebug("identity_link_failed", {
      provider: "line",
      visitor_uuid: session?.visitor_uuid ?? cookieState?.visitor_uuid ?? null,
      user_uuid: session?.user_uuid ?? null,
      reason: "line_oauth_failed",
      error: callbackError instanceof Error ? callbackError.message : String(callbackError),
      source_channel: context.source_channel,
    })

    const response = NextResponse.redirect(failureUrl, 303)
    clearLineOAuthStateCookie(response)

    return response
  }
}
