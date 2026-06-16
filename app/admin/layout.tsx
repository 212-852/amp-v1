import { redirect, unstable_rethrow } from "next/navigation"

import AdminRenderFallback from "@/components/admin/fallback"
import OpsShell from "@/components/ops/shell"
import { resolveAdminPageRender } from "@/core/admin/render"
import { sendAuthDebug } from "@/core/debug"
import {
  normalizeOpsHeaderSession,
  type OpsHeaderSession,
} from "@/core/ops/header_session"

function formatLayoutError(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function formatLayoutErrorStack(error: unknown) {
  if (process.env.NODE_ENV === "production") {
    return undefined
  }

  return error instanceof Error ? error.stack ?? null : null
}

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  let header_session: OpsHeaderSession = normalizeOpsHeaderSession(null, {
    default_display_name: "Admin",
    default_role: "admin",
  })

  try {
    const result = await resolveAdminPageRender()

    if (result.status === "redirect") {
      redirect(result.path)
    }

    if (result.status === "failed") {
      return <AdminRenderFallback message={result.error_message} />
    }

    header_session = result.header_session

    return <OpsShell session={header_session}>{children}</OpsShell>
  } catch (error) {
    unstable_rethrow(error)

    await sendAuthDebug("admin_page_render_failed", {
      pathname: "/admin",
      visitor_uuid: header_session.visitor_uuid,
      user_uuid: header_session.user_uuid,
      role: header_session.role,
      tier: header_session.tier,
      error_message: formatLayoutError(error),
      ...(formatLayoutErrorStack(error)
        ? { error_stack: formatLayoutErrorStack(error) }
        : {}),
      entry: "admin_layout",
    })

    return <AdminRenderFallback message={formatLayoutError(error)} />
  }
}
