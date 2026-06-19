import AdminConciergeQueue from "@/components/admin/concierge_queue"
import AdminShell from "@/components/admin/shell"
import { getConciergeAvailabilityState } from "@/core/chat/action"
import { get_concierge_queue } from "@/core/concierge/action"
import { resolveAuthContext } from "@/core/auth/context"
import { resolveSession } from "@/core/auth/session"

export default async function AdminConciergePage() {
  const context = await resolveAuthContext()
  const session = await resolveSession(context)
  const availability = await getConciergeAvailabilityState(session).catch(() => ({
    enabled: false,
  }))
  const queue = availability.enabled
    ? await get_concierge_queue(session, { limit: 50 }).catch(() => ({
        availability_enabled: false,
        should_show_list: false,
        room_condition: { mode: "concierge" as const },
        rooms: [],
        items: [],
      }))
    : {
        availability_enabled: false,
        should_show_list: false,
        room_condition: { mode: "concierge" as const },
        rooms: [],
        items: [],
      }

  return (
    <AdminShell session={session} pathname="/admin/concierge">
      <AdminConciergeQueue queue={queue} show_footer={false} />
    </AdminShell>
  )
}
