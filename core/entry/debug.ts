import { cookies, headers } from "next/headers"

import type { AuthContext, Session } from "@/core/auth/types"
import { resolve_line_user_id } from "@/core/auth/identity"
import { resolveRequestIdFromHeaders } from "@/core/auth/session"
import { sendAuthDebug } from "@/core/debug"
import {
  AUTH_LOGGED_OUT_COOKIE_NAME,
  SOURCE_CHANNEL_COOKIE_NAME,
  VISITOR_COOKIE_NAME,
} from "@/core/auth/session"

const LINE_LOGIN_STATE_COOKIE = "amp_line_oauth_state"
const SESSION_COOKIE_NAMES = new Set([
  VISITOR_COOKIE_NAME,
  "sb-access-token",
  "supabase-auth-token",
  LINE_LOGIN_STATE_COOKIE,
  SOURCE_CHANNEL_COOKIE_NAME,
  AUTH_LOGGED_OUT_COOKIE_NAME,
])

export function is_line_in_app_browser(user_agent: string | null | undefined) {
  return user_agent?.toLowerCase().includes("line") ?? false
}

function read_search_params(search: string | null) {
  if (!search) {
    return {}
  }

  const normalized = search.startsWith("?") ? search.slice(1) : search
  const params = new URLSearchParams(normalized)
  const entries: Record<string, string> = {}

  for (const [key, value] of params.entries()) {
    entries[key] = value
  }

  return entries
}

function resolve_has_liff_id(search_params: Record<string, string>) {
  return (
    search_params.source_channel === "liff" ||
    "liff" in search_params ||
    "liff_state" in search_params ||
    Boolean(process.env.NEXT_PUBLIC_LIFF_ID)
  )
}

export async function resolve_entry_request_id() {
  return resolveRequestIdFromHeaders()
}

export async function build_entry_page_opened_payload(input: {
  context: AuthContext
  session: Session
  pathname?: string
}) {
  const requestHeaders = await headers()
  const cookieStore = await cookies()
  const pathname =
    input.pathname ?? input.context.requested_route ?? "/entry"
  const search = requestHeaders.get("x-amp-search")
  const search_params = read_search_params(search)
  const user_agent = requestHeaders.get("user-agent")
  const host =
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    "app.da-nya.com"
  const proto = requestHeaders.get("x-forwarded-proto") ?? "https"
  const cookie_names = cookieStore.getAll().map((cookie) => cookie.name)
  const has_session_cookie = cookie_names.some((name) =>
    SESSION_COOKIE_NAMES.has(name),
  )

  return {
    request_id: await resolve_entry_request_id(),
    pathname,
    full_url: `${proto}://${host}${pathname}${search ?? ""}`,
    search_params,
    user_agent,
    is_line_browser: is_line_in_app_browser(user_agent),
    is_liff: input.context.source_channel === "liff",
    has_liff_id: resolve_has_liff_id(search_params),
    cookie_names,
    has_session_cookie,
    visitor_uuid: input.session.visitor_uuid,
    user_uuid: input.session.user_uuid,
  }
}

export async function send_entry_line_auth_debug(
  event: string,
  payload: Record<string, unknown>,
  request_id?: string | null,
) {
  const resolved_request_id =
    request_id ??
    (typeof payload.request_id === "string" ? payload.request_id : null) ??
    (await resolve_entry_request_id())

  await sendAuthDebug(
    event,
    {
      ...payload,
      request_id: resolved_request_id,
    },
    resolved_request_id,
  )
}

export async function resolve_entry_line_user_id(user_uuid: string | null) {
  if (!user_uuid) {
    return null
  }

  return resolve_line_user_id(user_uuid)
}

export const entry_line_auth_cookie_names = {
  visitor: VISITOR_COOKIE_NAME,
  line_oauth_state: LINE_LOGIN_STATE_COOKIE,
} as const
