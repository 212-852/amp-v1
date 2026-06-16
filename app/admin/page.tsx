import { redirect, unstable_rethrow } from "next/navigation"

import AdminComingSoon from "@/components/admin/coming-soon"
import AdminPageFallback from "@/components/admin/page_fallback"
import AdminShell from "@/components/admin/shell"
import { resolveAuthContext } from "@/core/auth/context"
import { resolveIdentity } from "@/core/auth/identity"
import { resolveAuthRoute, resolveRoleRedirectPath } from "@/core/auth/route"
import { resolveSession } from "@/core/auth/session"
import type { Session } from "@/core/auth/types"
import { sendAuthDebug } from "@/core/debug"
import { resolveEntranceContext } from "@/core/entrance/context"
import { isNextRedirectError } from "@/core/navigation/redirect"
import { normalizeOpsHeaderSession } from "@/core/ops/header_session"

const ADMIN_PATH = "/admin"

function buildDebugPayload(
  session: Session | null | undefined,
  pathname: string,
) {
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
    return null
  }

  return error instanceof Error ? error.stack ?? null : null
}

export default async function AdminPage() {
  try {
    await sendAuthDebug("admin_page_render_started", {
      pathname: ADMIN_PATH,
      visitor_uuid: null,
      user_uuid: null,
      role: null,
      tier: null,
    })

    const context = await resolveAuthContext()

    await sendAuthDebug(
      "admin_page_context_resolved",
      buildDebugPayload(null, context.requested_route ?? ADMIN_PATH),
    )

    const session = await resolveSession(context)

    await sendAuthDebug(
      "admin_page_session_resolved",
      buildDebugPayload(session, context.requested_route ?? ADMIN_PATH),
    )

    const entrance = await resolveEntranceContext()
    const identity = await resolveIdentity(context, session)
    const route = resolveAuthRoute(context, entrance, session, identity)

    await sendAuthDebug("admin_page_route_resolved", {
      ...buildDebugPayload(session, context.requested_route ?? ADMIN_PATH),
      route_path: route.path,
      route_role: route.role,
      route_tier: route.tier,
      identity_state: route.identity_state,
    })

    const redirect_to = resolveRoleRedirectPath(context, session)

    if (redirect_to && redirect_to !== (context.requested_route ?? ADMIN_PATH)) {
      redirect(redirect_to)
    }

    const safe_session = normalizeOpsHeaderSession(session, {
      default_display_name: "Admin",
      default_role: "admin",
    })

    await sendAuthDebug("admin_page_header_props_ready", {
      pathname: ADMIN_PATH,
      visitor_uuid: safe_session.visitor_uuid,
      user_uuid: safe_session.user_uuid,
      role: safe_session.role,
      tier: safe_session.tier,
      display_name: safe_session.display_name,
      image_url: safe_session.image_url,
    })

    await sendAuthDebug(
      "admin_page_render_success",
      buildDebugPayload(session, ADMIN_PATH),
    )

    return (
      <AdminShell session={safe_session}>
        <AdminComingSoon title="本日の状況" />
      </AdminShell>
    )
  } catch (error) {
    unstable_rethrow(error)

    if (isNextRedirectError(error)) {
      throw error
    }

    await sendAuthDebug("admin_page_render_failed", {
      pathname: ADMIN_PATH,
      visitor_uuid: null,
      user_uuid: null,
      role: null,
      tier: null,
      error_message: formatErrorMessage(error),
      error_stack: formatErrorStack(error),
      entry: "admin_page",
    })

    return <AdminPageFallback message={formatErrorMessage(error)} />
  }
}
