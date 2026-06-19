import AdminComingSoon from "@/components/admin/coming-soon"
import AdminShell from "@/components/admin/shell"
import { requireAdminAccess } from "@/core/admin/guard"

export default async function AdminNotificationsPage() {
  const { session } = await requireAdminAccess()

  return (
    <AdminShell session={session} pathname="/admin/notifications">
      <AdminComingSoon title="Notifications" />
    </AdminShell>
  )
}
