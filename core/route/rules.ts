import { resolveAuthContext } from "@/core/auth/context"
import { resolveIdentity } from "@/core/auth/identity"
import { resolveAuthRoute } from "@/core/auth/route"
import { resolveSession } from "@/core/auth/session"
import { resolveEntranceContext } from "@/core/entrance/context"

export type { AmpRouteKey, AmpRouteResult } from "@/core/auth/route"

export async function resolveAmpRoute() {
  const entrance = await resolveEntranceContext()
  const context = await resolveAuthContext()
  const session = await resolveSession(context)
  const identity = await resolveIdentity(context, session)

  return resolveAuthRoute(context, entrance, session, identity)
}
