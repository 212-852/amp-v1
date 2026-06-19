import { redirect } from "next/navigation"

import { resolveAuthContext } from "@/core/auth/context"
import { resolveIdentity } from "@/core/auth/identity"
import { homePathForRole, resolveAuthRoute } from "@/core/auth/route"
import { resolveSession } from "@/core/auth/session"
import { resolveEntranceContext } from "@/core/entrance/context"

export default async function Page() {
  const entrance = await resolveEntranceContext()
  const context = await resolveAuthContext("/")
  const session = await resolveSession(context)
  const identity = await resolveIdentity(context, session)
  const route = resolveAuthRoute(context, entrance, session, identity)

  redirect(route.path || homePathForRole(session.role))
}
