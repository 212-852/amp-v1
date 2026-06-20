import AdminConciergeQueue from "@/components/admin/concierge_queue"
import AdminOpsFrame from "@/components/admin/frame"
import { requireAdminAccess } from "@/core/admin/guard"
import { resolveAdminHomeQueue } from "@/core/admin/queue"

export default async function AdminPage() {
  const { session } = await requireAdminAccess("/admin")
  const queue = await resolveAdminHomeQueue(session)
  const show_waiting_list =
    queue.availability_enabled === true && queue.should_show_list === true

  return (
    <AdminOpsFrame pathname="/admin" session={session}>
      <AdminConciergeQueue
        queue={queue}
        variant="preview"
        seeded_from_server={show_waiting_list}
        availability_enabled={show_waiting_list}
      />
    </AdminOpsFrame>
  )
}
