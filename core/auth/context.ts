import { cookies, headers } from "next/headers"

import type { AuthContext, SourceChannel } from "@/core/auth/types"
import { SOURCE_CHANNEL_COOKIE_NAME } from "@/core/auth/session"
import { sendAuthDebug } from "@/core/debug"
import { resolveEntranceContext } from "@/core/entrance/context"

function resolveSourceChannel(
  surface: string,
  channelHeader: string | null,
  pathname: string | null,
  search: string | null,
  userAgent: string | null,
): SourceChannel {
  if (channelHeader === "web" || channelHeader === "pwa") {
    return channelHeader
  }

  if (channelHeader === "liff") {
    return "liff"
  }

  if (channelHeader === "line") {
    return "line"
  }

  const searchParams = new URLSearchParams(search?.replace(/^\?/, "") ?? "")

  if (
    searchParams.get("source_channel") === "liff" ||
    searchParams.has("liff") ||
    searchParams.has("liff_state")
  ) {
    return "liff"
  }

  if (userAgent?.toLowerCase().includes("line")) {
    return "liff"
  }

  if (pathname?.startsWith("/line")) {
    return "line"
  }

  if (surface === "liff") {
    return "liff"
  }

  if (surface === "pwa") {
    return "pwa"
  }

  if (surface === "line") {
    return "line"
  }

  return "web"
}

function resolveBearerToken(authorization: string | null) {
  if (!authorization?.startsWith("Bearer ")) {
    return null
  }

  return authorization.slice("Bearer ".length).trim() || null
}

export async function resolveAuthContext(
  requested_route_override?: string | null,
): Promise<AuthContext> {
  const entrance = await resolveEntranceContext()
  const requestHeaders = await headers()
  const cookieStore = await cookies()
  const pathname =
    requested_route_override ??
    requestHeaders.get("x-amp-pathname") ??
    requestHeaders.get("x-amp-route")
  const search = requestHeaders.get("x-amp-search")

  const persisted_channel = cookieStore.get(SOURCE_CHANNEL_COOKIE_NAME)?.value
  const header_channel =
    requestHeaders.get("x-amp-source-channel") ??
    requestHeaders.get("x-amp-session-source-channel") ??
    requestHeaders.get("x-amp-channel") ??
    (persisted_channel === "pwa" ||
    persisted_channel === "web" ||
    persisted_channel === "liff" ||
    persisted_channel === "line"
      ? persisted_channel
      : null)

  const context: AuthContext = {
    auth_token:
      resolveBearerToken(requestHeaders.get("authorization")) ??
      cookieStore.get("sb-access-token")?.value ??
      cookieStore.get("supabase-auth-token")?.value ??
      null,
    requested_route: pathname ?? null,
    source_channel: resolveSourceChannel(
      entrance.surface,
      header_channel,
      pathname,
      search,
      requestHeaders.get("user-agent"),
    ),
    locale: requestHeaders.get("x-amp-locale"),
  }

  await sendAuthDebug("auth_entry_detected", {
    source_channel: context.source_channel,
    requested_route: context.requested_route,
    has_auth_token: Boolean(context.auth_token),
  })

  return context
}
