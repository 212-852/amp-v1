import { cookies, headers } from "next/headers"

import type { AuthContext, SourceChannel } from "@/core/auth/types"
import { resolveEntranceContext } from "@/core/entrance/context"

function resolveSourceChannel(
  surface: string,
  channelHeader: string | null,
): SourceChannel {
  if (channelHeader === "line") {
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

  return {
    auth_token:
      resolveBearerToken(requestHeaders.get("authorization")) ??
      cookieStore.get("sb-access-token")?.value ??
      cookieStore.get("supabase-auth-token")?.value ??
      null,
    requested_route: requestHeaders.get("x-amp-route"),
    source_channel: resolveSourceChannel(
      entrance.surface,
      requestHeaders.get("x-amp-channel"),
    ),
    locale: requestHeaders.get("x-amp-locale"),
  }
}
