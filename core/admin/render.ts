import { redirect } from "next/navigation"

import { resolveAuthContext } from "@/core/auth/context"
import { resolveIdentity } from "@/core/auth/identity"
import { resolveAuthRoute, resolveRoleRedirectPath } from "@/core/auth/route"
import { resolveSession } from "@/core/auth/session"
import type { Session } from "@/core/auth/types"
import { sendAuthDebug } from "@/core/debug"
import { resolveEntranceContext } from "@/core/entrance/context"
import {
  normalizeOpsHeaderSession,
  type OpsHeaderSession,
} from "@/core/ops/header_session"

type AdminRenderDebug = {
  pathname: string | null
  visitor_uuid: string | null
  user_uuid: string | null
  role: string | null
  tier: string | null
}

function buildAdminRenderDebug(
  session: Session | null | undefined,
  pathname: string | null,
): AdminRenderDebug {
  return {
    pathname,
    visitor_uuid: session?.visitor_uuid ?? null,
    user_uuid: session?.user_uuid ?? null,
    role: session?.role ?? null,
    tier: session?.tier ?? null,
  }
}

function formatErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function formatErrorStack(error: unknown) {
  if (process.env.NODE_ENV !== "development") {
    return undefined
  }

  return error instanceof Error ? error.stack ?? null : null
}

export type AdminPageRenderResult = {
  header_session: OpsHeaderSession
}

export async function resolveAdminPageRender(): Promise<AdminPageRenderResult> {
  const context = await resolveAuthContext()
  const pathname = context.requested_route

  await sendAuthDebug(
    "admin_page_render_started",
    buildAdminRenderDebug(null, pathname),
  )

  try {
    const session = await resolveSession(context)

    await sendAuthDebug(
      "admin_page_session_resolved",
      buildAdminRenderDebug(session, pathname),
    )

    const entrance = await resolveEntranceContext()
    const identity = await resolveIdentity(context, session)
    const route = resolveAuthRoute(context, entrance, session, identity)

    await sendAuthDebug("admin_page_route_checked", {
      ...buildAdminRenderDebug(session, pathname),
      route_path: route.path,
      route_role: route.role,
      route_tier: route.tier,
      identity_state: route.identity_state,
    })

    const redirect_path = resolveRoleRedirectPath(context, session)

    if (redirect_path && redirect_path !== pathname) {
      redirect(redirect_path)
    }

    return {
      header_session: normalizeOpsHeaderSession(session, {
        default_display_name: "Admin",
        default_role: "admin",
      }),
    }
  } catch (error) {
    await sendAuthDebug("admin_page_render_failed", {
      ...buildAdminRenderDebug(null, pathname),
      error_message: formatErrorMessage(error),
      ...(formatErrorStack(error)
        ? { error_stack: formatErrorStack(error) }
        : {}),
    })

    redirect("/app")
  }
}
