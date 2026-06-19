import { redirect } from "next/navigation"

import { resolveAuthContext } from "@/core/auth/context"
import {
  canAccessPath,
  resolveRoleRedirectPath,
} from "@/core/auth/route"
import { resolveSession } from "@/core/auth/session"
import type { Session } from "@/core/auth/types"

export async function requireAdminAccess(): Promise<{
  session: Session
  pathname: string
}> {
  const context = await resolveAuthContext()
  const session = await resolveSession(context)
  const pathname = context.requested_route ?? "/admin"

  if (!canAccessPath(session.role, pathname)) {
    redirect(resolveRoleRedirectPath(context, session) ?? "/app")
  }

  const redirect_to = resolveRoleRedirectPath(context, session)

  if (redirect_to && redirect_to !== pathname) {
    redirect(redirect_to)
  }

  return { session, pathname }
}
