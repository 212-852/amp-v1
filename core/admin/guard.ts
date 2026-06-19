import { redirect } from "next/navigation"

import { resolveAuthContext } from "@/core/auth/context"
import {
  canAccessPath,
  homePathForRole,
  resolveRoleRedirectPath,
} from "@/core/auth/route"
import { resolveSession } from "@/core/auth/session"
import type { Session } from "@/core/auth/types"

export async function requireAdminAccess(pathname?: string): Promise<{
  session: Session
  pathname: string
}> {
  const resolved_pathname = pathname ?? "/admin"
  const context = await resolveAuthContext(resolved_pathname)
  const session = await resolveSession(context)

  if (!canAccessPath(session.role, resolved_pathname)) {
    redirect(
      resolveRoleRedirectPath(context, session) ??
        homePathForRole(session.role),
    )
  }

  const redirect_to = resolveRoleRedirectPath(context, session)

  if (redirect_to && redirect_to !== resolved_pathname) {
    redirect(redirect_to)
  }

  return { session, pathname: resolved_pathname }
}
