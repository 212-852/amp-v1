import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

import type { AuthContext, SourceChannel } from "@/core/auth/types"
import {
  classifyAccessRequest,
} from "@/core/access/request"
import {
  emitGuardedAccessSecurityEvents,
  resolveRoleRedirectPath,
} from "@/core/auth/route"
import { sendAuthDebug } from "@/core/debug"
import { SOURCE_CHANNEL_COOKIE_NAME } from "@/core/auth/session"
import {
  AUTH_LOGGED_OUT_COOKIE_NAME,
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
  const pathname = request.nextUrl.pathname

  if (
    pathname === "/app" ||
    pathname.startsWith("/app/") ||
    pathname === "/partner" ||
    pathname.startsWith("/partner/")
  ) {
    return "web"
  }

  const channel = request.headers.get("x-amp-channel")
  const persisted_channel = request.cookies.get(SOURCE_CHANNEL_COOKIE_NAME)?.value
  const sourceChannel = request.nextUrl.searchParams.get("source_channel")
  const userAgent = request.headers.get("user-agent") ?? ""

  if (
    channel === "web" ||
    channel === "liff" ||
    channel === "pwa" ||
    channel === "line"
  ) {
    return channel
  }

  if (
    persisted_channel === "web" ||
    persisted_channel === "liff" ||
    persisted_channel === "pwa" ||
    persisted_channel === "line"
  ) {
    return persisted_channel
  }

  if (sourceChannel === "liff") {
    return "liff"
  }

  if (
    request.nextUrl.searchParams.has("liff") ||
    request.nextUrl.searchParams.has("liff_state")
  ) {
    return "liff"
  }

  if (userAgent.toLowerCase().includes("line")) {
    return "liff"
  }

  if (request.nextUrl.pathname.startsWith("/line")) {
    return "line"
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

function formatProxyError(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function formatProxyErrorStack(error: unknown) {
  if (process.env.NODE_ENV === "production") {
    return null
  }

  return error instanceof Error ? error.stack ?? null : null
}

async function runProxy(request: NextRequest) {
  let pendingCookie: PendingCookie | null = null
  const context = resolveAuthContext(request)
  const requestVisitorUuid =
    request.cookies.get(VISITOR_COOKIE_NAME)?.value ?? null
  const authLoggedOut =
    request.cookies.get(AUTH_LOGGED_OUT_COOKIE_NAME)?.value === "true"
  const requestCacheKey = crypto.randomUUID()
  const requestId = crypto.randomUUID()
  const userAgentContainsLine = (
    request.headers.get("user-agent") ?? ""
  ).toLowerCase().includes("line")
  const session = await resolve_session_context(context, undefined, {
    request_id: requestId,
    cookie_value: requestVisitorUuid,
    cookie_was_found: Boolean(requestVisitorUuid),
    request_cache_key: requestCacheKey,
    pathname: request.nextUrl.pathname,
    search: request.nextUrl.search,
    user_agent_contains_line: userAgentContainsLine,
    auth_logged_out: authLoggedOut,
    set_cookie(name, value, options) {
      pendingCookie = { name, value, options }
    },
  })

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set("x-amp-request-id", requestId)
  requestHeaders.set("x-amp-session-source-channel", session.source_channel)
  requestHeaders.set("x-amp-session-role", session.role)
  requestHeaders.set("x-amp-session-tier", session.tier)

  if (session.visitor_uuid) {
    requestHeaders.set("x-amp-session-visitor-uuid", session.visitor_uuid)
  }
  const route_channel = resolveSourceChannel(request)
  requestHeaders.set("x-amp-source-channel", route_channel)
  requestHeaders.set("x-amp-pathname", request.nextUrl.pathname)
  requestHeaders.set("x-amp-search", request.nextUrl.search)
  requestHeaders.set(
    "x-amp-user-agent-contains-line",
    String(userAgentContainsLine),
  )

  if (session.user_uuid) {
    requestHeaders.set("x-amp-session-user-uuid", session.user_uuid)
  }

  if (session.display_name) {
    requestHeaders.set("x-amp-session-display-name", session.display_name)
  }

  if (session.image_url) {
    requestHeaders.set("x-amp-session-image-url", session.image_url)
  }

  if (session.provider) {
    requestHeaders.set("x-amp-session-provider", session.provider)
  }

  if (session.email) {
    requestHeaders.set("x-amp-session-email", session.email)
  }

  const pathname = request.nextUrl.pathname

  if (pathname === "/admin/concierge") {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = "/admin"
    redirectUrl.search = ""
    const response = NextResponse.redirect(redirectUrl, 308)
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

  const legacy_concierge_room = pathname.match(/^\/admin\/concierge\/([^/]+)$/)

  if (legacy_concierge_room) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = `/admin/list/${legacy_concierge_room[1]}`
    redirectUrl.search = ""
    const response = NextResponse.redirect(redirectUrl, 308)
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

  if (pathname.startsWith("/admin") || pathname.startsWith("/driver")) {
    const access_request_kind = classifyAccessRequest({
      headers: request.headers,
      search: request.nextUrl.search,
    })

    if (access_request_kind === "direct_navigation") {
      await emitGuardedAccessSecurityEvents(context, session, {
        request_id: requestId,
        user_agent: request.headers.get("user-agent"),
        ip:
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          request.headers.get("x-real-ip"),
        access_request_kind,
      }).catch(() => null)
    }
  }

  const redirectPath = resolveRoleRedirectPath(context, session)

  if (redirectPath && redirectPath !== request.nextUrl.pathname) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = redirectPath
    redirectUrl.search = ""
    const response = NextResponse.redirect(redirectUrl)
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

export async function proxy(request: NextRequest) {
  try {
    return await runProxy(request)
  } catch (error) {
    console.error("proxy_route_resolution_failed", {
      pathname: request.nextUrl.pathname,
      search: request.nextUrl.search,
      error_message: formatProxyError(error),
      error_stack: formatProxyErrorStack(error),
    })

    await sendAuthDebug("proxy_request_failed", {
      pathname: request.nextUrl.pathname,
      error_message: formatProxyError(error),
      error_stack: formatProxyErrorStack(error),
    }).catch(() => null)

    const requestHeaders = new Headers(request.headers)
    requestHeaders.set("x-amp-pathname", request.nextUrl.pathname)
    requestHeaders.set("x-amp-search", request.nextUrl.search)

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    })
  }
}

export const config = {
  matcher: [
    "/api/chat/:path*",
    "/((?!api|_next/static|_next/image|images|.*\\..*).*)",
  ],
}
