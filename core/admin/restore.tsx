import { redirect, unstable_rethrow } from "next/navigation"

import AdminDataSections from "@/components/admin/data_sections"
import AdminHeader from "@/components/admin/header"
import AdminPageFallback from "@/components/admin/page_fallback"
import AdminSessionPanel from "@/components/admin/session_panel"
import AdminShellLayout from "@/components/admin/shell_layout"
import { loadAdminDashboardData } from "@/core/admin/data"
import { resolveAuthContext } from "@/core/auth/context"
import { resolveIdentity } from "@/core/auth/identity"
import { resolveAuthRoute, resolveRoleRedirectPath } from "@/core/auth/route"
import { resolveSession } from "@/core/auth/session"
import type { Session } from "@/core/auth/types"
import { sendAuthDebug } from "@/core/debug"
import { resolveEntranceContext } from "@/core/entrance/context"
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

async function sendRestoreDebug(
  event: string,
  payload: Record<string, unknown>,
) {
  await sendAuthDebug(event, {
    restore_step: resolveAdminRestoreStep(),
    ...payload,
  })
}

export function resolveAdminRestoreStep() {
  const raw = process.env.ADMIN_RESTORE_STEP ?? "1"
  const step = Number(raw)

  if (!Number.isFinite(step) || step < 1) {
    return 1
  }

  return Math.min(step, 5)
}

export async function renderAdminRestorePage() {
  const step = resolveAdminRestoreStep()

  try {
    const context = await resolveAuthContext()

    await sendRestoreDebug(
      "admin_restore_step_context_ok",
      buildDebugPayload(null, context.requested_route ?? ADMIN_PATH),
    )

    const session = await resolveSession(context)

    await sendRestoreDebug(
      "admin_restore_step_session_ok",
      buildDebugPayload(session, context.requested_route ?? ADMIN_PATH),
    )

    if (step === 1) {
      return (
        <div className="min-h-dvh bg-neutral-50 px-5 py-6 text-neutral-900">
          <AdminSessionPanel session={session} />
        </div>
      )
    }

    const entrance = await resolveEntranceContext()
    const identity = await resolveIdentity(context, session)
    const route = resolveAuthRoute(context, entrance, session, identity)
    const redirect_to = resolveRoleRedirectPath(context, session)

    await sendRestoreDebug("admin_restore_step_route_ok", {
      ...buildDebugPayload(session, context.requested_route ?? ADMIN_PATH),
      route_path: route.path,
      route_role: route.role,
      route_tier: route.tier,
      redirect_to,
    })

    if (redirect_to && redirect_to !== (context.requested_route ?? ADMIN_PATH)) {
      redirect(redirect_to)
    }

    const header_session = normalizeOpsHeaderSession(session, {
      default_display_name: "Admin",
      default_role: "admin",
    })

    if (step === 2) {
      return (
        <div className="min-h-dvh bg-neutral-50 px-5 py-6 text-neutral-900">
          <AdminSessionPanel session={session} />
          <p className="mt-4 text-[13px] text-neutral-500">Route ok for admin.</p>
        </div>
      )
    }

    const header = <AdminHeader session={header_session} />

    if (step === 3) {
      await sendRestoreDebug("admin_restore_step_header_ok", {
        pathname: ADMIN_PATH,
        visitor_uuid: header_session.visitor_uuid,
        user_uuid: header_session.user_uuid,
        role: header_session.role,
        tier: header_session.tier,
        display_name: header_session.display_name,
      })

      return (
        <div className="min-h-dvh bg-neutral-50 text-neutral-900">
          {header}
          <main className="px-5 py-6">
            <p className="text-[13px] text-neutral-500">Header only restore step.</p>
          </main>
        </div>
      )
    }

    if (step === 4) {
      await sendRestoreDebug("admin_restore_step_header_ok", {
        pathname: ADMIN_PATH,
        visitor_uuid: header_session.visitor_uuid,
        user_uuid: header_session.user_uuid,
        role: header_session.role,
        tier: header_session.tier,
        display_name: header_session.display_name,
      })

      await sendRestoreDebug("admin_restore_step_shell_ok", {
        pathname: ADMIN_PATH,
      })

      return <AdminShellLayout header={header} />
    }

    await sendRestoreDebug("admin_restore_step_header_ok", {
      pathname: ADMIN_PATH,
      visitor_uuid: header_session.visitor_uuid,
      user_uuid: header_session.user_uuid,
      role: header_session.role,
      tier: header_session.tier,
      display_name: header_session.display_name,
    })

    await sendRestoreDebug("admin_restore_step_shell_ok", {
      pathname: ADMIN_PATH,
    })

    const data = await loadAdminDashboardData()

    await sendRestoreDebug("admin_restore_step_data_ok", {
      pathname: ADMIN_PATH,
      orders: data.orders?.value ?? null,
      drivers: data.drivers?.value ?? null,
      notifications: data.notifications?.value ?? null,
    })

    return (
      <AdminShellLayout header={header}>
        <AdminDataSections data={data} />
      </AdminShellLayout>
    )
  } catch (error) {
    unstable_rethrow(error)

    await sendRestoreDebug("admin_restore_failed", {
      pathname: ADMIN_PATH,
      error_message: formatErrorMessage(error),
      error_stack: formatErrorStack(error),
    })

    return <AdminPageFallback message={formatErrorMessage(error)} />
  }
}
