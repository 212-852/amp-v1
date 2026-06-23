import { redirect } from "next/navigation"

import { resolveAuthContext } from "@/core/auth/context"
import { resolveIdentity } from "@/core/auth/identity"
import { enforceEntryLineAccess, resolveAuthRoute } from "@/core/auth/route"
import { resolveSession } from "@/core/auth/session"
import { resolveEntranceContext } from "@/core/entrance/context"

export type { AmpRouteKey, AmpRouteResult } from "@/core/auth/route"

export async function resolveAmpRouteForPath(requested_route: string) {
  const entrance = await resolveEntranceContext()
  const context = await resolveAuthContext(requested_route)
  const session = await resolveSession(context)
  const identity = await resolveIdentity(context, session)

  return resolveAuthRoute(context, entrance, session, identity)
}

export async function resolveAmpRoute() {
  return resolveAmpRouteForPath("/")
}

export async function enforceAuthRouteRedirect(requested_route: string) {
  const route = await resolveAmpRouteForPath(requested_route)

  if (route.path !== requested_route) {
    redirect(route.path)
  }

  return route
}

export async function enforce_entry_line_access() {
  const context = await resolveAuthContext("/entry")
  const session = await resolveSession(context)
  const identity = await resolveIdentity(context, session)
  const route = resolveAuthRoute(
    context,
    await resolveEntranceContext(),
    session,
    identity,
  )
  const entry_identity = await enforceEntryLineAccess(context, session)

  return {
    context,
    entry_identity,
    identity,
    route,
    session,
    line_user_id: entry_identity.line_user_id,
  }
}
