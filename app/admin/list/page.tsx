import AdminConciergeQueue from "@/components/admin/concierge_queue"
import AdminOpsFrame from "@/components/admin/frame"
import { requireAdminAccess } from "@/core/admin/guard"
import { resolveAdminListQueue } from "@/core/admin/queue"

export default async function AdminListPage() {
  const { session } = await requireAdminAccess("/admin/list")
  const queue = await resolveAdminListQueue(session)
  const show_waiting_list =
    queue.availability_enabled === true && queue.should_show_list === true

  return (
    <AdminOpsFrame pathname="/admin/list" session={session}>
      <AdminConciergeQueue
        queue={queue}
        variant="tabs"
        seeded_from_server={show_waiting_list}
        availability_enabled={show_waiting_list}
      />
    </AdminOpsFrame>
  )
}
