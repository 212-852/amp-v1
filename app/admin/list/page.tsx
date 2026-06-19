import AdminConciergeQueue from "@/components/admin/concierge_queue"
import AdminShell from "@/components/admin/shell"
import { requireAdminAccess } from "@/core/admin/guard"
import { resolveAdminListQueue } from "@/core/admin/queue"

export default async function AdminListPage() {
  const { session } = await requireAdminAccess()
  const queue = await resolveAdminListQueue(session)

  return (
    <AdminShell session={session} pathname="/admin/list">
      <AdminConciergeQueue queue={queue} variant="tabs" seeded_from_server />
    </AdminShell>
  )
}
