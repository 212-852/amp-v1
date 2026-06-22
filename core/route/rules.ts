import { redirect } from "next/navigation"

import { resolveAuthContext } from "@/core/auth/context"
import { resolve_line_user_id } from "@/core/auth/identity"
import { resolveIdentity } from "@/core/auth/identity"
import { resolveAuthRoute } from "@/core/auth/route"
import { resolveSession } from "@/core/auth/session"
import { resolveEntranceContext } from "@/core/entrance/context"

export type { AmpRouteKey, AmpRouteResult } from "@/core/auth/route"

const ENTRY_HOME_URL = "https://app.da-nya.com/"

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
  const entrance = await resolveEntranceContext()
  const context = await resolveAuthContext("/entry")
  const session = await resolveSession(context)
  const identity = await resolveIdentity(context, session)
  const route = resolveAuthRoute(context, entrance, session, identity)

  if (!session.user_uuid) {
    redirect(ENTRY_HOME_URL)
  }

  const line_user_id = await resolve_line_user_id(session.user_uuid)

  if (!line_user_id) {
    redirect(ENTRY_HOME_URL)
  }

  return {
    context,
    identity,
    route,
    session,
    line_user_id,
  }
}
