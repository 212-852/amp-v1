import OpsShell from "@/components/ops/shell"
import { build_breadcrumb_output } from "@/core/breadcrumb/output"
import { getConciergeAvailabilityState } from "@/core/chat/action"
import {
  normalizeOpsHeaderSession,
  type HeaderSessionLike,
} from "@/core/ops/header_session"

export default async function AdminOpsFrame({
  children,
  session,
  pathname,
  breadcrumb_room_name,
}: Readonly<{
  children: React.ReactNode
  session?: HeaderSessionLike | null
  pathname: string
  breadcrumb_room_name?: string | null
}>) {
  const header_session = normalizeOpsHeaderSession(session, {
    default_display_name: "Admin",
    default_role: "admin",
  })
  const breadcrumbs = build_breadcrumb_output({
    pathname,
    room_name: breadcrumb_room_name,
  })
  const is_room_page = /^\/admin\/list\/[^/]+$/.test(pathname)
  const show_breadcrumb =
    pathname !== "/admin" && breadcrumbs.items.length > 0
  const availability = await getConciergeAvailabilityState(session)

  return (
    <OpsShell
      pathname={pathname}
      session={header_session}
      show_assistant={pathname === "/admin"}
      breadcrumb_items={show_breadcrumb ? breadcrumbs.items : []}
      layout={is_room_page ? "full_height" : "default"}
      concierge_available={availability.enabled}
      notification_type={availability.notification_type}
    >
      {children}
    </OpsShell>
  )
}
