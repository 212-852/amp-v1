import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

import type { AuthContext, SourceChannel } from "@/core/auth/types"
import {
  emitGuardedAccessSecurityEvents,
  resolveRoleRedirectPath,
} from "@/core/auth/route"
import { sendAuthDebug } from "@/core/debug"
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
  requestHeaders.set("x-amp-source-channel", session.source_channel)
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

  if (pathname.startsWith("/admin") || pathname.startsWith("/driver")) {
    await emitGuardedAccessSecurityEvents(context, session, {
      request_id: requestId,
      user_agent: request.headers.get("user-agent"),
      ip:
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        request.headers.get("x-real-ip"),
    }).catch(() => null)
  }

  const redirectPath = resolveRoleRedirectPath(context, session)
  const isAdminPath = pathname.startsWith("/admin")
  const redirectsOutOfAdmin =
    isAdminPath && redirectPath && !redirectPath.startsWith("/admin")

  if (
    redirectPath &&
    redirectPath !== request.nextUrl.pathname &&
    !redirectsOutOfAdmin
  ) {
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
    await sendAuthDebug("proxy_request_failed", {
      pathname: request.nextUrl.pathname,
      error_message: formatProxyError(error),
      error_stack: formatProxyErrorStack(error),
    })

    return NextResponse.next()
  }
}

export const config = {
  matcher: [
    "/api/chat/:path*",
    "/((?!api|_next/static|_next/image|images|.*\\..*).*)",
  ],
}
