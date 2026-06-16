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

export type AdminPageRenderResult =
  | {
      status: "success"
      header_session: OpsHeaderSession
    }
  | {
      status: "redirect"
      path: string
    }
  | {
      status: "failed"
      error_message: string
      header_session: OpsHeaderSession
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
  if (process.env.NODE_ENV === "production") {
    return undefined
  }

  return error instanceof Error ? error.stack ?? null : null
}

function buildFailedResult(
  error: unknown,
  pathname: string | null,
): AdminPageRenderResult {
  return {
    status: "failed",
    error_message: formatErrorMessage(error),
    header_session: normalizeOpsHeaderSession(null, {
      default_display_name: "Admin",
      default_role: "admin",
    }),
  }
}

export async function resolveAdminPageRender(): Promise<AdminPageRenderResult> {
  let pathname: string | null = null

  await sendAuthDebug("admin_page_render_started", {
    pathname,
    visitor_uuid: null,
    user_uuid: null,
    role: null,
    tier: null,
  })

  try {
    const context = await resolveAuthContext()
    pathname = context.requested_route

    await sendAuthDebug(
      "admin_page_context_resolved",
      buildAdminRenderDebug(null, pathname),
    )

    const session = await resolveSession(context)

    await sendAuthDebug(
      "admin_page_session_resolved",
      buildAdminRenderDebug(session, pathname),
    )

    const entrance = await resolveEntranceContext()
    const identity = await resolveIdentity(context, session)
    const route = resolveAuthRoute(context, entrance, session, identity)

    await sendAuthDebug("admin_page_route_decided", {
      ...buildAdminRenderDebug(session, pathname),
      route_path: route.path,
      route_role: route.role,
      route_tier: route.tier,
      identity_state: route.identity_state,
    })

    const redirect_path = resolveRoleRedirectPath(context, session)

    if (redirect_path && redirect_path !== pathname) {
      return {
        status: "redirect",
        path: redirect_path,
      }
    }

    const header_session = normalizeOpsHeaderSession(session, {
      default_display_name: "Admin",
      default_role: "admin",
    })

    await sendAuthDebug("admin_page_header_props_ready", {
      pathname,
      visitor_uuid: header_session.visitor_uuid,
      user_uuid: header_session.user_uuid,
      role: header_session.role,
      tier: header_session.tier,
      display_name: header_session.display_name,
      image_url: header_session.image_url,
    })

    await sendAuthDebug(
      "admin_page_render_success",
      buildAdminRenderDebug(session, pathname),
    )

    return {
      status: "success",
      header_session,
    }
  } catch (error) {
    await sendAuthDebug("admin_page_render_failed", {
      ...buildAdminRenderDebug(null, pathname),
      error_message: formatErrorMessage(error),
      ...(formatErrorStack(error)
        ? { error_stack: formatErrorStack(error) }
        : {}),
    })

    return buildFailedResult(error, pathname)
  }
}
