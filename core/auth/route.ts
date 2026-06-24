import { redirect } from "next/navigation"
import { headers } from "next/headers"

import type { EntranceContext } from "@/core/entrance/context"
import type {
  AuthContext,
  AuthRouteResult,
  IdentityRecord,
  Session,
  SessionRole,
} from "@/core/auth/types"
import { resolve_entry_line_identity } from "@/core/auth/identity"
import {
  has_line_authenticated_session,
  read_line_browser_auth_state,
  resolveLineBrowserAccess,
  type LineBrowserAccessDecision,
} from "@/core/auth/line_browser"
import { send_line_auth_debug } from "@/core/auth/line_debug"
import { resolveRequestIdFromHeaders } from "@/core/auth/session"
import {
  is_line_in_app_browser,
  send_entry_line_auth_debug,
} from "@/core/entry/debug"

const ENTRY_RETURN_TO = "/entry"
const LINE_LOGIN_STATE_COOKIE = "amp_line_oauth_state"

export type AmpRouteKey =
  | "app-top"
  | "driver-top"
  | "admin-top"
  | "corporate-top"
  | "airport-top"
  | "tokyo-top"

export type AmpRouteResult = AuthRouteResult & {
  key: AmpRouteKey
  title: string
}

type AccessZone = "admin" | "driver" | "user"

const ZONE_ACCESS: Record<SessionRole, AccessZone[]> = {
  admin: ["admin", "driver", "user"],
  owner: ["admin", "driver", "user"],
  concierge: ["admin", "driver", "user"],
  driver: ["driver", "user"],
  user: ["user"],
  guest: ["user"],
}

export function homePathForRole(role: SessionRole) {
  if (role === "admin" || role === "owner" || role === "concierge") {
    return "/admin"
  }

  if (role === "driver") {
    return "/driver"
  }

  return "/app"
}

function keyForPath(path: string): AmpRouteKey {
  if (path === "/admin") {
    return "admin-top"
  }

  if (path === "/driver") {
    return "driver-top"
  }

  return "app-top"
}

function titleForPath(path: string) {
  if (path === "/admin") {
    return "Admin Top"
  }

  if (path === "/driver") {
    return "Driver Top"
  }

  return "App Top"
}

function resolveAccessZone(pathname: string): AccessZone | null {
  if (pathname.startsWith("/admin")) {
    return "admin"
  }

  if (pathname.startsWith("/driver")) {
    return "driver"
  }

  if (pathname.startsWith("/app")) {
    return "user"
  }

  if (pathname.startsWith("/user")) {
    return "user"
  }

  if (pathname.startsWith("/mypage")) {
    return "user"
  }

  return null
}

export function canAccessPath(role: SessionRole, pathname: string) {
  const zone = resolveAccessZone(pathname)

  if (!zone) {
    return true
  }

  return ZONE_ACCESS[role].includes(zone)
}

export function resolveRoleRedirectPath(context: AuthContext, session: Session) {
  const pathname = context.requested_route ?? "/"

  if (!canAccessPath(session.role, pathname)) {
    return homePathForRole(session.role)
  }

  if (pathname === "/" || pathname === "") {
    if (session.role === "driver") {
      return "/app"
    }

    return homePathForRole(session.role)
  }

  if (
    pathname === "/app" &&
    (session.role === "admin" ||
      session.role === "owner" ||
      session.role === "concierge" ||
      session.role === "driver")
  ) {
    return homePathForRole(session.role)
  }

  return null
}

function resolveEntryPath(
  context: AuthContext,
  entrance: EntranceContext,
  session: Session,
  identity: IdentityRecord,
): AmpRouteResult {
  if (entrance.type === "corporate") {
    return {
      key: "corporate-top",
      path: "/corporate",
      title: "Corporate Top",
      role: session.role,
      tier: session.tier,
      identity_state: identity.identity_state,
    }
  }

  if (entrance.type === "airport") {
    return {
      key: "airport-top",
      path: "/airport",
      title: "Airport Top",
      role: session.role,
      tier: session.tier,
      identity_state: identity.identity_state,
    }
  }

  if (entrance.type === "tokyo") {
    return {
      key: "tokyo-top",
      path: "/tokyo",
      title: "Tokyo Top",
      role: session.role,
      tier: session.tier,
      identity_state: identity.identity_state,
    }
  }

  const path =
    resolveRoleRedirectPath(context, session) ??
    context.requested_route ??
    homePathForRole(session.role)

  return {
    key: keyForPath(path),
    path,
    title: titleForPath(path),
    role: session.role,
    tier: session.tier,
    identity_state: identity.identity_state,
  }
}

export function resolveAuthRoute(
  context: AuthContext,
  entrance: EntranceContext,
  session: Session,
  identity: IdentityRecord,
): AmpRouteResult {
  return resolveEntryPath(context, entrance, session, identity)
}

export type LineBrowserAccessResult =
  | { allowed: true }
  | { loop_blocked: true }
  | { redirect_to: string; return_to: string }

export async function enforceLineBrowserAccess(input: {
  context: AuthContext
  session: Session
  identity: IdentityRecord
  pathname: string
  search?: string | null
}): Promise<LineBrowserAccessResult> {
  const decision = await resolveLineBrowserAccess(input)

  if (decision.status === "allowed") {
    return { allowed: true }
  }

  if (decision.status === "loop_blocked") {
    return { loop_blocked: true }
  }

  redirect(decision.redirect_to)
}

export async function resolveLineBrowserAccessForRoute(
  pathname: string,
  search?: string | null,
): Promise<LineBrowserAccessDecision> {
  const { resolveAuthContext } = await import("@/core/auth/context")
  const { resolveSession } = await import("@/core/auth/session")
  const { resolveIdentity } = await import("@/core/auth/identity")

  const context = await resolveAuthContext(pathname)
  const session = await resolveSession(context)
  const identity = await resolveIdentity(context, session)

  return resolveLineBrowserAccess({
    context,
    session,
    identity,
    pathname,
    search,
  })
}

export async function enforceEntryLineAccess(
  context: AuthContext,
  session: Session,
) {
  const request_id = await resolveRequestIdFromHeaders()
  const entry_identity = await resolve_entry_line_identity(context, session)
  const line_auth_state = await read_line_browser_auth_state({
    context,
    session,
    identity: {
      user_uuid: session.user_uuid,
      identity_state: session.user_uuid ? "linked" : "anonymous",
      linked_providers: [],
    },
    pathname: context.requested_route ?? "/entry",
  })
  const has_verified_liff_session =
    Boolean(session.liff?.provider_user_id) ||
    (session.liff?.verified === true &&
      Boolean(entry_identity.liff_provider_user_id))
  const has_linked_line_identity =
    has_line_authenticated_session(session, {
      user_uuid: session.user_uuid,
      identity_state: session.user_uuid ? "linked" : "anonymous",
      linked_providers: [],
    }) ||
    Boolean(entry_identity.line_user_id) ||
    Boolean(
      entry_identity.provider === "line" &&
        entry_identity.provider_user_id,
    ) ||
    Boolean(
      session.provider === "line" &&
        session.provider_user_id,
    ) ||
    has_verified_liff_session
  const has_entry_access = has_linked_line_identity
  const login_url = `/api/auth/line/start?return_to=${encodeURIComponent(ENTRY_RETURN_TO)}`
  const redirect_required = !has_entry_access
  const redirect_to = redirect_required ? login_url : null
  const redirect_reason = redirect_required ? "line_identity_missing" : null

  if (line_auth_state.loop_blocked && redirect_required) {
    await send_line_auth_debug("LOOP_BLOCKED", {
      pathname: context.requested_route ?? "/entry",
      return_to: ENTRY_RETURN_TO,
      has_session_cookie: line_auth_state.has_session_cookie,
      visitor_uuid_exists: line_auth_state.visitor_uuid_exists,
      user_uuid_exists: line_auth_state.user_uuid_exists,
      provider: line_auth_state.provider,
      provider_user_id_exists: line_auth_state.provider_user_id_exists,
      identity_exists: line_auth_state.identity_exists,
      session_write_success: false,
      redirect_to: null,
      redirect_reason: "callback_succeeded_without_session",
    })

    redirect("/entry?line_auth_loop=1")
  }

  await send_entry_line_auth_debug("entry_guard_checked", {
    request_id,
    user_uuid: session.user_uuid,
    visitor_uuid: session.visitor_uuid,
    provider: entry_identity.provider,
    provider_user_id_exists: Boolean(entry_identity.provider_user_id),
    line_user_id_exists: Boolean(entry_identity.line_user_id),
    session_provider: session.provider,
    session_provider_user_id_exists: Boolean(session.provider_user_id),
    liff_provider_user_id_exists: Boolean(entry_identity.liff_provider_user_id),
    has_line_identity: entry_identity.has_line_identity,
    redirect_required,
    redirect_to,
    redirect_reason,
    pathname: context.requested_route ?? "/entry",
    is_liff: context.source_channel === "liff",
  })

  if (redirect_required) {
    const requestHeaders = await headers()
    await send_entry_line_auth_debug("entry_redirect_to_line_login", {
      request_id,
      return_to: ENTRY_RETURN_TO,
      login_url_exists: Boolean(login_url),
      state_exists: false,
      state_key: LINE_LOGIN_STATE_COOKIE,
      is_line_browser: is_line_in_app_browser(requestHeaders.get("user-agent")),
      redirect_to: login_url,
    })
    redirect(login_url)
  }

  return entry_identity
}

export type GuardedAccessMeta = {
  request_id?: string | null
  user_agent?: string | null
  ip?: string | null
  access_request_kind?: "direct_navigation" | "prefetch" | "rsc_fetch"
}

function buildAccessPayload(
  context: AuthContext,
  session: Session,
  meta: GuardedAccessMeta,
) {
  const pathname = context.requested_route ?? ""

  return {
    pathname,
    role: session.role,
    tier: session.tier,
    user_uuid: session.user_uuid,
    visitor_uuid: session.visitor_uuid,
    request_id: meta.request_id ?? null,
    user_agent: meta.user_agent ?? null,
    ip: meta.ip ?? null,
  }
}

export async function emitGuardedAccessSecurityEvents(
  context: AuthContext,
  session: Session,
  meta: GuardedAccessMeta,
) {
  if (
    meta.access_request_kind === "prefetch" ||
    meta.access_request_kind === "rsc_fetch"
  ) {
    return
  }

  const pathname = context.requested_route ?? ""
  const base_payload = buildAccessPayload(context, session, meta)

  if (pathname.startsWith("/admin")) {
    if (session.role === "admin") {
      const { sendAuthDebug } = await import("@/core/debug")

      await sendAuthDebug(
        "admin_page_accessed",
        base_payload,
        meta.request_id ?? null,
      )
      return
    }

    const { recordSecurityAccessEvent } = await import("@/core/access")

    await recordSecurityAccessEvent({
      request_id: meta.request_id ?? null,
      category: "security",
      severity: "high",
      event: "admin_page_unauthorized_access",
      pathname,
      user_uuid: session.user_uuid,
      visitor_uuid: session.visitor_uuid,
      role: session.role,
      tier: session.tier,
      ip: meta.ip ?? null,
      user_agent: meta.user_agent ?? null,
      notify_payload: {
        ...base_payload,
        resolved_role: session.role,
      },
    })
    return
  }

  if (pathname.startsWith("/driver")) {
    if (canAccessPath(session.role, pathname)) {
      return
    }

    const { recordSecurityAccessEvent } = await import("@/core/access")

    await recordSecurityAccessEvent({
      request_id: meta.request_id ?? null,
      category: "security",
      severity: "warning",
      event: "driver_page_unauthorized_access",
      pathname,
      user_uuid: session.user_uuid,
      visitor_uuid: session.visitor_uuid,
      role: session.role,
      tier: session.tier,
      ip: meta.ip ?? null,
      user_agent: meta.user_agent ?? null,
      notify_payload: {
        ...base_payload,
        resolved_role: session.role,
      },
    })
  }
}

export async function emitAdminAccessNotifications(
  context: AuthContext,
  session: Session,
  meta: GuardedAccessMeta,
) {
  return emitGuardedAccessSecurityEvents(context, session, meta)
}
