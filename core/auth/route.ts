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
