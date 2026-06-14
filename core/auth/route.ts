import type { EntranceContext } from "@/core/entrance/context"
import type {
  AuthContext,
  AuthRouteResult,
  IdentityRecord,
  Session,
  SessionRole,
  SessionTier,
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

function resolveEntryPath(
  entrance: EntranceContext,
  session: Session,
  identity: IdentityRecord,
): AmpRouteResult {
  const role: SessionRole = "guest"
  const tier: SessionTier = "guest"

  void session

  if (entrance.type === "corporate") {
    return {
      key: "corporate-top",
      path: "/corporate",
      title: "Corporate Top",
      role,
      tier,
      identity_state: identity.identity_state,
    }
  }

  if (entrance.type === "airport") {
    return {
      key: "airport-top",
      path: "/airport",
      title: "Airport Top",
      role,
      tier,
      identity_state: identity.identity_state,
    }
  }

  if (entrance.type === "tokyo") {
    return {
      key: "tokyo-top",
      path: "/tokyo",
      title: "Tokyo Top",
      role,
      tier,
      identity_state: identity.identity_state,
    }
  }

  return {
    key: "app-top",
    path: "/",
    title: "App Top",
    role,
    tier,
    identity_state: identity.identity_state,
  }
}

export function resolveAuthRoute(
  context: AuthContext,
  entrance: EntranceContext,
  session: Session,
  identity: IdentityRecord,
): AmpRouteResult {
  void context

  return resolveEntryPath(entrance, session, identity)
}
