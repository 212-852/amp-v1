import AdminConciergeQueue from "@/components/admin/concierge_queue"
import AdminShell from "@/components/admin/shell"
import { requireAdminAccess } from "@/core/admin/guard"
import { getConciergeAvailabilityState } from "@/core/chat/action"
import { get_concierge_queue } from "@/core/concierge/action"

export default async function AdminListPage() {
  const { session } = await requireAdminAccess()
  const availability = await getConciergeAvailabilityState(session).catch(() => ({
    enabled: false,
  }))
  const queue = availability.enabled
    ? await get_concierge_queue(session, { limit: 50, mode: "concierge" }).catch(
        () => ({
          availability_enabled: false,
          should_show_list: false,
          room_condition: { mode: "concierge" as const },
          rooms: [],
          items: [],
        }),
      )
    : {
        availability_enabled: false,
        should_show_list: false,
        room_condition: { mode: "concierge" as const },
        rooms: [],
        items: [],
      }

  return (
    <AdminShell session={session} pathname="/admin/list">
      <AdminConciergeQueue queue={queue} variant="tabs" />
    </AdminShell>
  )
}
