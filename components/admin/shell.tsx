import OpsAssistant from "@/components/ops/assistant"
import OpsHeader from "@/components/ops/header"
import AdminBreadcrumb from "@/components/admin/breadcrumb"
import { build_breadcrumb_output } from "@/core/breadcrumb/output"
import { getConciergeAvailabilityState } from "@/core/chat/action"
import { resolvePageLabel } from "@/core/ops/page_label"
import {
  normalizeOpsHeaderSession,
  type HeaderSessionLike,
} from "@/core/ops/header_session"

export default async function AdminShell({
  children,
  session,
  pathname = "/admin",
  breadcrumb_room_name,
}: Readonly<{
  children: React.ReactNode
  session?: HeaderSessionLike | null
  pathname?: string
  breadcrumb_room_name?: string | null
}>) {
  const header_session = normalizeOpsHeaderSession(session, {
    default_display_name: "Admin",
    default_role: "admin",
  })
  const page_label = resolvePageLabel(pathname)
  const breadcrumbs = build_breadcrumb_output({
    pathname,
    room_name: breadcrumb_room_name,
  })
  const concierge_available = (await getConciergeAvailabilityState(session)).enabled
  const show_assistant = pathname === "/admin"

  return (
    <div className="min-h-dvh bg-neutral-50 text-neutral-900">
      <OpsHeader
        session={header_session}
        page_label={page_label}
        concierge_available={concierge_available}
      />
      <AdminBreadcrumb items={breadcrumbs.items} />
      <main className="mx-auto flex h-dvh w-full max-w-[430px] flex-col gap-3 overflow-hidden px-5 pb-[calc(118px+env(safe-area-inset-bottom,0px))] pt-2">
        {children}
      </main>
      {show_assistant ? <OpsAssistant /> : null}
    </div>
  )
}
