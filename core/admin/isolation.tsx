import { redirect, unstable_rethrow } from "next/navigation"

import AdminComingSoon from "@/components/admin/coming-soon"
import AdminPageFallback from "@/components/admin/page_fallback"
import AdminShell from "@/components/admin/shell"
import OpsHeader from "@/components/ops/header"
import { resolveAuthContext } from "@/core/auth/context"
import { resolveIdentity } from "@/core/auth/identity"
import { resolveAuthRoute, resolveRoleRedirectPath } from "@/core/auth/route"
import { resolveSession } from "@/core/auth/session"
import type { Session } from "@/core/auth/types"
import { sendAuthDebug } from "@/core/debug"
import { resolveEntranceContext } from "@/core/entrance/context"
import { normalizeOpsHeaderSession } from "@/core/ops/header_session"
import { resolvePageLabel } from "@/core/ops/page_label"

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

async function sendStageDebug(
  event: string,
  payload: Record<string, unknown>,
) {
  await sendAuthDebug(event, {
    isolation_stage: resolveAdminIsolationStage(),
    ...payload,
  })
}

export function resolveAdminIsolationStage() {
  const raw = process.env.ADMIN_ISOLATION_STAGE

  if (!raw) {
    return 0
  }

  const stage = Number(raw)

  return Number.isFinite(stage) ? stage : 0
}

export async function renderAdminIsolationPage() {
  const stage = resolveAdminIsolationStage()

  if (stage <= 0) {
    return <div>admin alive</div>
  }

  try {
    await sendStageDebug("admin_page_render_started", {
      pathname: ADMIN_PATH,
      visitor_uuid: null,
      user_uuid: null,
      role: null,
      tier: null,
    })

    const context = await resolveAuthContext()

    await sendStageDebug(
      "admin_page_context_resolved",
      buildDebugPayload(null, context.requested_route ?? ADMIN_PATH),
    )

    if (stage === 1) {
      await sendStageDebug("admin_page_render_success", {
        pathname: ADMIN_PATH,
        stage: 1,
      })
      return <div>admin alive stage 1 context ok</div>
    }

    const session = await resolveSession(context)

    await sendStageDebug(
      "admin_page_session_resolved",
      buildDebugPayload(session, context.requested_route ?? ADMIN_PATH),
    )

    if (stage === 2) {
      await sendStageDebug("admin_page_render_success", {
        pathname: ADMIN_PATH,
        stage: 2,
        role: session.role,
        tier: session.tier,
      })
      return <div>admin alive stage 2 session ok</div>
    }

    const entrance = await resolveEntranceContext()
    const identity = await resolveIdentity(context, session)
    const route = resolveAuthRoute(context, entrance, session, identity)

    await sendStageDebug("admin_page_route_resolved", {
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
    const pathname = context.requested_route ?? ADMIN_PATH
    const page_label = resolvePageLabel(pathname)

    await sendStageDebug("admin_page_header_props_ready", {
      pathname: ADMIN_PATH,
      visitor_uuid: safe_session.visitor_uuid,
      user_uuid: safe_session.user_uuid,
      role: safe_session.role,
      tier: safe_session.tier,
      display_name: safe_session.display_name,
      image_url: safe_session.image_url,
    })

    if (stage === 3) {
      await sendStageDebug("admin_page_render_success", {
        pathname: ADMIN_PATH,
        stage: 3,
      })
      return <div>admin alive stage 3 route ok</div>
    }

    if (stage === 4) {
      await sendStageDebug("admin_page_render_success", {
        pathname: ADMIN_PATH,
        stage: 4,
      })

      return (
        <div className="min-h-dvh bg-neutral-50 text-neutral-900">
          <OpsHeader session={safe_session} page_label={page_label} />
          <main style={{ padding: 24 }}>
            <div>admin alive stage 4 header ok</div>
          </main>
        </div>
      )
    }

    await sendStageDebug(
      "admin_page_render_success",
      buildDebugPayload(session, ADMIN_PATH),
    )

    return (
      <AdminShell session={safe_session} pathname={pathname}>
        <AdminComingSoon title="本日の状況" />
      </AdminShell>
    )
  } catch (error) {
    unstable_rethrow(error)

    await sendStageDebug("admin_page_render_failed", {
      pathname: ADMIN_PATH,
      visitor_uuid: null,
      user_uuid: null,
      role: null,
      tier: null,
      error_message: formatErrorMessage(error),
      error_stack: formatErrorStack(error),
      entry: "admin_isolation",
    })

    return <AdminPageFallback message={formatErrorMessage(error)} />
  }
}
