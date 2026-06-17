import AdminConciergeQueue from "@/components/admin/concierge_queue"
import AdminShell from "@/components/admin/shell"
import { loadConciergeQueueForSession } from "@/core/chat/action"
import { resolveAuthContext } from "@/core/auth/context"
import { resolveSession } from "@/core/auth/session"

export default async function AdminConciergePage() {
  const context = await resolveAuthContext()
  const session = await resolveSession(context)
  const items = await loadConciergeQueueForSession(session, { limit: 50 }).catch(
    () => [],
  )

  return (
    <AdminShell session={session} pathname="/admin/concierge">
      <AdminConciergeQueue items={items} show_footer={false} />
    </AdminShell>
  )
}
