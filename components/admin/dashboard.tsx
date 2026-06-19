import AdminConciergeQueue from "@/components/admin/concierge_queue"
import AdminDataSections from "@/components/admin/data_sections"
import { loadAdminDashboardData } from "@/core/admin/data"
import { getConciergeAvailabilityState } from "@/core/chat/action"
import { get_concierge_queue } from "@/core/concierge/action"
import type { Session } from "@/core/auth/types"

const PREVIEW_ROOM_LIMIT = 5

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
      limit: PREVIEW_ROOM_LIMIT,
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

export default async function AdminDashboard({
  session,
}: Readonly<{
  session: Session
}>) {
  return (
    <>
      <AdminDataSections data={await loadAdminDashboardData()} />
      <AdminConciergeQueue
        queue={await resolveConciergeQueuePreview(session)}
        variant="preview"
      />
    </>
  )
}
