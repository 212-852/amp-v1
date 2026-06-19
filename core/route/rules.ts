import { redirect } from "next/navigation"

import { resolveAuthContext } from "@/core/auth/context"
import { resolveIdentity } from "@/core/auth/identity"
import { resolveAuthRoute } from "@/core/auth/route"
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
