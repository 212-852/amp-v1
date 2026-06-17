import type { EntranceContext } from "@/core/entrance/context"
import type {
  AuthContext,
  AuthRouteResult,
  IdentityRecord,
  Session,
  SessionRole,
} from "@/core/auth/types"

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

function homePathForRole(role: SessionRole) {
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

  const path = resolveRoleRedirectPath(context, session) ?? context.requested_route ?? "/app"

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

export type GuardedAccessMeta = {
  request_id?: string | null
  user_agent?: string | null
  ip?: string | null
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
  const pathname = context.requested_route ?? ""
  const base_payload = buildAccessPayload(context, session, meta)

  if (pathname.startsWith("/admin")) {
    if (session.role === "admin") {
      const { notifyEvent } = await import("@/core/notify")

      await notifyEvent({
        event: "admin_page_accessed",
        request_id: meta.request_id ?? null,
        payload: base_payload,
      })
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
