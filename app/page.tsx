import { redirect, unstable_rethrow } from "next/navigation"

import { resolveAuthContext } from "@/core/auth/context"
import { resolveIdentity } from "@/core/auth/identity"
import { resolveAuthRoute } from "@/core/auth/route"
import { resolveSession } from "@/core/auth/session"
import { resolveEntranceContext } from "@/core/entrance/context"

export default async function Page() {
  try {
    const entrance = await resolveEntranceContext()
    const context = await resolveAuthContext("/")
    const session = await resolveSession(context)
    const identity = await resolveIdentity(context, session)
    const route = resolveAuthRoute(context, entrance, session, identity)

    redirect(route.path)
  } catch (error) {
    unstable_rethrow(error)
    console.error("root_route_resolution_failed", {
      error_message: error instanceof Error ? error.message : String(error),
      error_stack:
        process.env.NODE_ENV === "production"
          ? null
          : error instanceof Error
            ? error.stack
            : null,
    })
    throw error
  }
}
