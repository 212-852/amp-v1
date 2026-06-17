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

function homePathForRole(role: SessionRole) {
  if (role === "admin") {
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

function guardedRoleForPath(pathname: string | null): SessionRole | null {
  if (pathname?.startsWith("/admin")) {
    return "admin"
  }

  if (pathname?.startsWith("/driver")) {
    return "driver"
  }

  return null
}

export function resolveRoleRedirectPath(context: AuthContext, session: Session) {
  const pathname = context.requested_route ?? "/"
  const homePath = homePathForRole(session.role)
  const requiredRole = guardedRoleForPath(pathname)

  if (requiredRole && requiredRole !== session.role) {
    return homePath
  }

  if (pathname === "/" || pathname === "") {
    return homePath
  }

  if (pathname === "/app" && (session.role === "admin" || session.role === "driver")) {
    return homePath
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

export type AdminAccessNotifyMeta = {
  request_id?: string | null
  user_agent?: string | null
  ip?: string | null
}

export async function emitAdminAccessNotifications(
  context: AuthContext,
  session: Session,
  meta: AdminAccessNotifyMeta,
) {
  const pathname = context.requested_route ?? ""

  if (!pathname.startsWith("/admin")) {
    return
  }

  const base_payload = {
    pathname,
    role: session.role,
    tier: session.tier,
    user_uuid: session.user_uuid,
    visitor_uuid: session.visitor_uuid,
    request_id: meta.request_id ?? null,
    user_agent: meta.user_agent ?? null,
    ip: meta.ip ?? null,
  }

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
}
