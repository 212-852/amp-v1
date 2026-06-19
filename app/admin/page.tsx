import AdminBreadcrumb from "@/components/admin/breadcrumb"
import AdminConciergeQueue from "@/components/admin/concierge_queue"
import AdminDataSections from "@/components/admin/data_sections"
import AdminFooter from "@/components/admin/footer"
import AdminHeader from "@/components/admin/header"
import { loadAdminDashboardData } from "@/core/admin/data"
import { requireAdminAccess } from "@/core/admin/guard"
import { build_breadcrumb_output } from "@/core/breadcrumb/output"
import { getConciergeAvailabilityState } from "@/core/chat/action"
import { get_concierge_queue } from "@/core/concierge/action"
import { normalizeOpsHeaderDisplay } from "@/core/ops/header_session"
import { resolvePageLabel } from "@/core/ops/page_label"
import type { Session } from "@/core/auth/types"

async function resolveConciergeQueuePreview(session: Session) {
  try {
    const availability = await getConciergeAvailabilityState(session)

    if (!availability.enabled) {
      return {
        availability_enabled: false,
        should_show_list: false,
        room_condition: { mode: "concierge" as const },
        rooms: [],
        items: [],
      }
    }

    return await get_concierge_queue(session, {
      limit: 5,
      mode: "concierge",
      strict_concierge: true,
    })
  } catch {
    return {
      availability_enabled: false,
      should_show_list: false,
      room_condition: { mode: "concierge" as const },
      rooms: [],
      items: [],
    }
  }
}

export default async function AdminPage() {
  const { session } = await requireAdminAccess()
  const header_session = normalizeOpsHeaderDisplay(session)
  const breadcrumbs = build_breadcrumb_output({ pathname: "/admin" })
  const concierge_available = await getConciergeAvailabilityState(session)
    .then((state) => state.enabled)
    .catch(() => false)

  return (
    <>
      <AdminHeader
        session={header_session}
        page_label={resolvePageLabel("/admin")}
        concierge_available={concierge_available}
      />
      <AdminBreadcrumb items={breadcrumbs.items} />
      <main className="mx-auto flex w-full max-w-[430px] flex-col gap-3 px-5 pb-[calc(118px+env(safe-area-inset-bottom,0px))] pt-2">
        <AdminDataSections data={await loadAdminDashboardData()} />
        <AdminConciergeQueue
          queue={await resolveConciergeQueuePreview(session)}
          variant="preview"
        />
      </main>
      <AdminFooter />
    </>
  )
}
