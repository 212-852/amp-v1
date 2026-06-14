import { cookies, headers } from "next/headers"

import type { AuthContext, SourceChannel } from "@/core/auth/types"
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

export async function resolveAuthContext(): Promise<AuthContext> {
  const entrance = await resolveEntranceContext()
  const requestHeaders = await headers()
  const cookieStore = await cookies()
  const pathname =
    requestHeaders.get("x-amp-pathname") ?? requestHeaders.get("x-amp-route")
  const search = requestHeaders.get("x-amp-search")

  return {
    auth_token:
      resolveBearerToken(requestHeaders.get("authorization")) ??
      cookieStore.get("sb-access-token")?.value ??
      cookieStore.get("supabase-auth-token")?.value ??
      null,
    requested_route: pathname,
    source_channel: resolveSourceChannel(
      entrance.surface,
      requestHeaders.get("x-amp-source-channel") ??
        requestHeaders.get("x-amp-session-source-channel") ??
        requestHeaders.get("x-amp-channel"),
      pathname,
      search,
      requestHeaders.get("user-agent"),
    ),
    locale: requestHeaders.get("x-amp-locale"),
  }
}
