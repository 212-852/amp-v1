import AdminConciergeQueue from "@/components/admin/concierge_queue"
import AdminOpsFrame from "@/components/admin/frame"
import { requireAdminAccess } from "@/core/admin/guard"
import { resolveAdminListQueue } from "@/core/admin/queue"

export default async function AdminListPage() {
  const { session } = await requireAdminAccess("/admin/list")
  const queue = await resolveAdminListQueue(session)

  return (
    <AdminOpsFrame pathname="/admin/list" session={session}>
      <AdminConciergeQueue queue={queue} />
    </AdminOpsFrame>
  )
}
