import type { NextRequest } from "next/server"

import { resolveAuthContext } from "@/core/auth/context"
import { resolveIdentity } from "@/core/auth/identity"
import { resolveAuthRoute, type AmpRouteResult } from "@/core/auth/route"
import {
  resolve_session_context,
  SOURCE_CHANNEL_COOKIE_MAX_AGE,
  SOURCE_CHANNEL_COOKIE_NAME,
  VISITOR_COOKIE_NAME,
  visitorCookieOptions,
  type AppSession,
  type CookieOptions,
} from "@/core/auth/session"
import type { AuthContext, IdentityRecord, SourceChannel } from "@/core/auth/types"
import { sendAuthDebug } from "@/core/debug"
import { resolveEntranceContext } from "@/core/entrance/context"

export type PendingSessionCookie = {
  name: string
  value: string
  options: CookieOptions
}

export type AuthSessionRestoreResult = {
  ok: boolean
  restored: boolean
  session: AppSession
  identity: IdentityRecord
  route: AmpRouteResult
  cookies: PendingSessionCookie[]
  error?: string
}

function normalizeSourceChannel(value: string | null | undefined): SourceChannel | null {
  return value === "web" ||
    value === "pwa" ||
    value === "liff" ||
    value === "line"
    ? value
    : null
}

function resolveChannelFromRequest(request: NextRequest | null | undefined) {
  if (!request) {
    return null
  }

  return (
    normalizeSourceChannel(request.headers.get("x-amp-channel")) ??
    normalizeSourceChannel(request.headers.get("x-amp-source-channel")) ??
    normalizeSourceChannel(request.cookies.get(SOURCE_CHANNEL_COOKIE_NAME)?.value ?? null)
  )
}

function withChannelContext(
  context: AuthContext,
  channel: SourceChannel | null,
): AuthContext {
  if (!channel) {
    return context
  }

  return {
    ...context,
    source_channel: channel,
  }
}

function buildAnonymousIdentity(): IdentityRecord {
  return {
    user_uuid: null,
    identity_state: "anonymous",
    linked_providers: [],
  }
}

function buildFallbackRoute(session: AppSession): AmpRouteResult {
  return {
    key: "app-top",
    path: "/app",
    title: "App Top",
    role: session.role,
    tier: session.tier,
    identity_state: "anonymous",
  }
}

export function applySessionCookies(
  response: { cookies: { set: (name: string, value: string, options: CookieOptions) => void } },
  cookies: PendingSessionCookie[],
) {
  for (const cookie of cookies) {
    response.cookies.set(cookie.name, cookie.value, cookie.options)
  }
}

export async function restoreAuthSession(input?: {
  request?: NextRequest | null
  requested_route?: string | null
}): Promise<AuthSessionRestoreResult> {
  const request = input?.request ?? null
  const requested_route =
    input?.requested_route ?? request?.nextUrl.pathname ?? "/"
  const channel = resolveChannelFromRequest(request)
  const pendingCookies: PendingSessionCookie[] = []
  const visitorCookieValue = request?.cookies.get(VISITOR_COOKIE_NAME)?.value ?? null

  let context = withChannelContext(
    await resolveAuthContext(requested_route),
    channel,
  )

  await sendAuthDebug("session_restore_started", {
    pathname: requested_route,
    source_channel: context.source_channel,
    cookie_found: Boolean(visitorCookieValue),
    visitor_uuid: visitorCookieValue,
  })

  try {
    const session = await resolve_session_context(context, undefined, {
      cookie_value: visitorCookieValue,
      cookie_was_found: Boolean(visitorCookieValue),
      pathname: requested_route,
      request_cache_key: request ? crypto.randomUUID() : undefined,
      set_cookie(name, value, options) {
        pendingCookies.push({ name, value, options })
      },
    })

    const identity = await resolveIdentity(context, session)
    const entrance = await resolveEntranceContext()
    const route = resolveAuthRoute(context, entrance, session, identity)

    if (channel === "pwa") {
      pendingCookies.push({
        name: SOURCE_CHANNEL_COOKIE_NAME,
        value: "pwa",
        options: {
          ...visitorCookieOptions,
          maxAge: SOURCE_CHANNEL_COOKIE_MAX_AGE,
        },
      })
    }

    const restored = Boolean(session.visitor_uuid)

    await sendAuthDebug("session_restore_success", {
      pathname: requested_route,
      source_channel: session.source_channel,
      visitor_uuid: session.visitor_uuid,
      user_uuid: session.user_uuid,
      restored,
    })

    return {
      ok: true,
      restored,
      session,
      identity,
      route,
      cookies: pendingCookies,
    }
  } catch (error) {
    const error_message = error instanceof Error ? error.message : String(error)

    await sendAuthDebug("session_restore_failed", {
      pathname: requested_route,
      source_channel: context.source_channel,
      error_message,
    })

    return {
      ok: false,
      restored: false,
      session: {
        visitor_uuid: null,
        user_uuid: null,
        role: "guest",
        tier: "guest",
        display_name: null,
        image_url: null,
        provider: null,
        email: null,
        source_channel: context.source_channel,
        can_logout: false,
        can_start_line_oauth:
          context.source_channel === "web" || context.source_channel === "pwa",
      },
      identity: buildAnonymousIdentity(),
      route: buildFallbackRoute({
        visitor_uuid: null,
        user_uuid: null,
        role: "guest",
        tier: "guest",
        display_name: null,
        image_url: null,
        provider: null,
        email: null,
        source_channel: context.source_channel,
        can_logout: false,
        can_start_line_oauth:
          context.source_channel === "web" || context.source_channel === "pwa",
      }),
      cookies: pendingCookies,
      error: error_message,
    }
  }
}
