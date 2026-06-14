import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

import type { AuthContext, SourceChannel } from "@/core/auth/types"
import {
  resolve_session_context,
  VISITOR_COOKIE_NAME,
  type CookieOptions,
} from "@/core/auth/session"

type PendingCookie = {
  name: string
  value: string
  options: CookieOptions
}

function resolveBearerToken(authorization: string | null) {
  if (!authorization?.startsWith("Bearer ")) {
    return null
  }

  return authorization.slice("Bearer ".length).trim() || null
}

function resolveSourceChannel(request: NextRequest): SourceChannel {
  const channel = request.headers.get("x-amp-channel")

  if (
    channel === "web" ||
    channel === "liff" ||
    channel === "pwa" ||
    channel === "line"
  ) {
    return channel
  }

  return "web"
}

function resolveAuthContext(request: NextRequest): AuthContext {
  return {
    auth_token:
      resolveBearerToken(request.headers.get("authorization")) ??
      request.cookies.get("sb-access-token")?.value ??
      request.cookies.get("supabase-auth-token")?.value ??
      null,
    requested_route: request.nextUrl.pathname,
    source_channel: resolveSourceChannel(request),
    locale: request.headers.get("x-amp-locale"),
  }
}

export async function proxy(request: NextRequest) {
  let pendingCookie: PendingCookie | null = null
  const context = resolveAuthContext(request)
  const requestVisitorUuid =
    request.cookies.get(VISITOR_COOKIE_NAME)?.value ?? null
  const visitorUuidHint = requestVisitorUuid ?? crypto.randomUUID()
  const session = await resolve_session_context(context, undefined, {
    cookie_value: requestVisitorUuid,
    cookie_was_found: Boolean(requestVisitorUuid),
    visitor_uuid_hint: visitorUuidHint,
    request_cache_key: visitorUuidHint,
    pathname: request.nextUrl.pathname,
    set_cookie(name, value, options) {
      pendingCookie = { name, value, options }
    },
  })

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set("x-amp-session-visitor-uuid", session.visitor_uuid)
  requestHeaders.set("x-amp-session-source-channel", session.source_channel)

  if (session.user_uuid) {
    requestHeaders.set("x-amp-session-user-uuid", session.user_uuid)
  }

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })

  const cookieToSet = pendingCookie as PendingCookie | null

  if (cookieToSet) {
    response.cookies.set(
      cookieToSet.name,
      cookieToSet.value,
      cookieToSet.options,
    )
  }

  return response
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|images|.*\\..*).*)",
  ],
}
