import { createHmac, timingSafeEqual } from "node:crypto"
import { cookies, headers } from "next/headers"

import type { AuthContext, IdentityRecord, Session } from "@/core/auth/types"
import { is_line_in_app_browser } from "@/core/entry/debug"
import {
  AUTH_LOGGED_OUT_COOKIE_NAME,
  VISITOR_COOKIE_NAME,
} from "@/core/auth/session"
import { send_line_auth_debug } from "@/core/auth/line_debug"

export const LINE_LOGIN_GUARD_COOKIE = "amp_line_login_guard"
export const LINE_LOGIN_GUARD_MAX_AGE_SECONDS = 60

type LineLoginGuardPayload = {
  attempted_at: string
  callback_at?: string | null
  visitor_uuid?: string | null
}

type LineBrowserCookieOptions = {
  httpOnly: boolean
  maxAge: number
  path: string
  sameSite: "lax"
  secure: boolean
}

export const lineBrowserCookieOptions: LineBrowserCookieOptions = {
  httpOnly: true,
  maxAge: LINE_LOGIN_GUARD_MAX_AGE_SECONDS,
  path: "/",
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
}

function lineLoginGuardSecret() {
  return (
    process.env.OAUTH_STATE_SECRET ??
    process.env.OTP_SECRET ??
    process.env.LINE_LOGIN_CHANNEL_SECRET ??
    "amp-line-login-guard-dev-secret"
  )
}

function signLineLoginGuardPayload(value: string) {
  return createHmac("sha256", lineLoginGuardSecret()).update(value).digest("base64url")
}

export function encodeLineLoginGuardCookie(payload: LineLoginGuardPayload) {
  const value = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url")
  return `${value}.${signLineLoginGuardPayload(value)}`
}

export function parseLineLoginGuardCookie(
  value: string | null | undefined,
): LineLoginGuardPayload | null {
  if (!value) {
    return null
  }

  const [payload_value, signature] = value.split(".")

  if (!payload_value || !signature) {
    return null
  }

  const expected_signature = signLineLoginGuardPayload(payload_value)
  const actual = Buffer.from(signature)
  const expected = Buffer.from(expected_signature)

  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return null
  }

  try {
    const payload = JSON.parse(
      Buffer.from(payload_value, "base64url").toString("utf8"),
    ) as Partial<LineLoginGuardPayload>

    if (typeof payload.attempted_at !== "string") {
      return null
    }

    return {
      attempted_at: payload.attempted_at,
      callback_at:
        typeof payload.callback_at === "string" ? payload.callback_at : null,
      visitor_uuid:
        typeof payload.visitor_uuid === "string" ? payload.visitor_uuid : null,
    }
  } catch {
    return null
  }
}

function parseTimestamp(value: string | null | undefined) {
  if (!value) {
    return null
  }

  const parsed = Date.parse(value)

  return Number.isFinite(parsed) ? parsed : null
}

function isWithinGuardWindow(timestamp: number | null) {
  if (timestamp == null) {
    return false
  }

  return Date.now() - timestamp <= LINE_LOGIN_GUARD_MAX_AGE_SECONDS * 1000
}

export function build_line_browser_return_to(pathname: string, search: string | null) {
  const normalized_path = pathname.startsWith("/") ? pathname : `/${pathname}`
  const normalized_search = search?.trim() ?? ""

  if (!normalized_search) {
    return normalized_path
  }

  return normalized_search.startsWith("?")
    ? `${normalized_path}${normalized_search}`
    : `${normalized_path}?${normalized_search}`
}

export function is_line_browser_context(input: {
  context: AuthContext
  user_agent?: string | null
}) {
  if (input.context.source_channel === "liff") {
    return true
  }

  return is_line_in_app_browser(input.user_agent)
}

export function has_line_authenticated_session(
  session: Session,
  identity: IdentityRecord,
) {
  if (!session.user_uuid || !session.visitor_uuid) {
    return false
  }

  if (session.provider === "line" && session.provider_user_id) {
    return true
  }

  if (identity.user_uuid && session.user_uuid === identity.user_uuid) {
    if (session.provider === "line" && session.provider_user_id) {
      return true
    }
  }

  if (session.liff?.verified && session.liff.provider_user_id) {
    return true
  }

  return false
}

export async function read_line_browser_auth_state(input: {
  context: AuthContext
  session: Session
  identity: IdentityRecord
  pathname: string
  search?: string | null
}) {
  const requestHeaders = await headers()
  const cookieStore = await cookies()
  const user_agent = requestHeaders.get("user-agent")
  const is_line_browser = is_line_browser_context({
    context: input.context,
    user_agent,
  })
  const has_session_cookie = Boolean(cookieStore.get(VISITOR_COOKIE_NAME)?.value)
  const guard = parseLineLoginGuardCookie(
    cookieStore.get(LINE_LOGIN_GUARD_COOKIE)?.value,
  )
  const callback_at = parseTimestamp(guard?.callback_at)
  const attempted_at = parseTimestamp(guard?.attempted_at)
  const callback_recent = isWithinGuardWindow(callback_at)
  const attempted_recent = isWithinGuardWindow(attempted_at)
  const authenticated = has_line_authenticated_session(input.session, input.identity)
  const auth_logged_out =
    cookieStore.get(AUTH_LOGGED_OUT_COOKIE_NAME)?.value === "true"
  const loop_blocked = callback_recent && !authenticated
  const return_to = build_line_browser_return_to(
    input.pathname,
    input.search ?? requestHeaders.get("x-amp-search"),
  )

  return {
    is_line_browser,
    has_session_cookie,
    visitor_uuid_exists: Boolean(input.session.visitor_uuid),
    user_uuid_exists: Boolean(input.session.user_uuid),
    provider: input.session.provider,
    provider_user_id_exists: Boolean(input.session.provider_user_id),
    identity_exists: input.identity.identity_state === "linked",
    authenticated,
    auth_logged_out,
    loop_blocked,
    callback_recent,
    attempted_recent,
    return_to,
    guard,
  }
}

export type LineBrowserAccessDecision =
  | { status: "allowed" }
  | { status: "loop_blocked" }
  | { status: "redirect_login"; redirect_to: string; return_to: string }

export async function resolveLineBrowserAccess(input: {
  context: AuthContext
  session: Session
  identity: IdentityRecord
  pathname: string
  search?: string | null
}): Promise<LineBrowserAccessDecision> {
  const state = await read_line_browser_auth_state(input)

  await send_line_auth_debug("ROUTE_GUARD_CHECKED", {
    pathname: input.pathname,
    return_to: state.return_to,
    is_line_browser: state.is_line_browser,
    has_session_cookie: state.has_session_cookie,
    visitor_uuid_exists: state.visitor_uuid_exists,
    user_uuid_exists: state.user_uuid_exists,
    provider: state.provider,
    provider_user_id_exists: state.provider_user_id_exists,
    identity_exists: state.identity_exists,
    session_write_success: state.authenticated,
    redirect_to: null,
    redirect_reason: null,
  })

  if (!state.is_line_browser) {
    return { status: "allowed" }
  }

  if (state.authenticated) {
    return { status: "allowed" }
  }

  if (state.auth_logged_out) {
    return { status: "allowed" }
  }

  if (state.loop_blocked) {
    await send_line_auth_debug("LOOP_BLOCKED", {
      pathname: input.pathname,
      return_to: state.return_to,
      has_session_cookie: state.has_session_cookie,
      visitor_uuid_exists: state.visitor_uuid_exists,
      user_uuid_exists: state.user_uuid_exists,
      provider: state.provider,
      provider_user_id_exists: state.provider_user_id_exists,
      identity_exists: state.identity_exists,
      session_write_success: false,
      redirect_to: null,
      redirect_reason: "callback_succeeded_without_session",
    })

    return { status: "loop_blocked" }
  }

  const redirect_to = `/api/auth/line/start?return_to=${encodeURIComponent(state.return_to)}`

  await send_line_auth_debug("ROUTE_GUARD_CHECKED", {
    pathname: input.pathname,
    return_to: state.return_to,
    is_line_browser: state.is_line_browser,
    has_session_cookie: state.has_session_cookie,
    visitor_uuid_exists: state.visitor_uuid_exists,
    user_uuid_exists: state.user_uuid_exists,
    provider: state.provider,
    provider_user_id_exists: state.provider_user_id_exists,
    identity_exists: state.identity_exists,
    session_write_success: false,
    redirect_to,
    redirect_reason: "line_identity_missing",
  })

  return {
    status: "redirect_login",
    redirect_to,
    return_to: state.return_to,
  }
}

export function setLineLoginGuardAttemptedCookie(
  response: {
    cookies: {
      set: (
        name: string,
        value: string,
        options: LineBrowserCookieOptions,
      ) => void
    }
  },
  input: {
    visitor_uuid: string | null
    previous?: LineLoginGuardPayload | null
  },
) {
  response.cookies.set(
    LINE_LOGIN_GUARD_COOKIE,
    encodeLineLoginGuardCookie({
      attempted_at: new Date().toISOString(),
      callback_at: input.previous?.callback_at ?? null,
      visitor_uuid: input.visitor_uuid,
    }),
    lineBrowserCookieOptions,
  )
}

export function setLineLoginGuardCallbackCookie(
  response: {
    cookies: {
      set: (
        name: string,
        value: string,
        options: LineBrowserCookieOptions,
      ) => void
    }
  },
  input: {
    visitor_uuid: string | null
    previous?: LineLoginGuardPayload | null
  },
) {
  response.cookies.set(
    LINE_LOGIN_GUARD_COOKIE,
    encodeLineLoginGuardCookie({
      attempted_at: input.previous?.attempted_at ?? new Date().toISOString(),
      callback_at: new Date().toISOString(),
      visitor_uuid: input.visitor_uuid,
    }),
    lineBrowserCookieOptions,
  )
}

export function clearLineLoginGuardCookie(response: {
  cookies: {
    set: (
      name: string,
      value: string,
      options: LineBrowserCookieOptions & { maxAge?: number },
    ) => void
  }
}) {
  response.cookies.set(LINE_LOGIN_GUARD_COOKIE, "", {
    ...lineBrowserCookieOptions,
    maxAge: 0,
  })
}
