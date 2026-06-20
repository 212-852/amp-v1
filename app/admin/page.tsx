import AdminConciergeQueue from "@/components/admin/concierge_queue"
import AdminOpsFrame from "@/components/admin/frame"
import { requireAdminAccess } from "@/core/admin/guard"
import { resolveAdminHomeQueue } from "@/core/admin/queue"

export default async function AdminPage() {
  const { session } = await requireAdminAccess("/admin")
  const queue = await resolveAdminHomeQueue(session)

  return (
    <AdminOpsFrame pathname="/admin" session={session}>
      {queue.availability_enabled ? (
        <AdminConciergeQueue
          queue={queue}
          variant="preview"
          seeded_from_server
        />
      ) : null}
    </AdminOpsFrame>
  )
}
