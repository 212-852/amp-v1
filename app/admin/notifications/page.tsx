import AdminComingSoon from "@/components/admin/coming-soon"
import AdminOpsFrame from "@/components/admin/frame"
import { requireAdminAccess } from "@/core/admin/guard"

export default async function AdminNotificationsPage() {
  const { session } = await requireAdminAccess()

  return (
    <AdminOpsFrame pathname="/admin/notifications" session={session}>
      <AdminComingSoon title="Notifications" />
    </AdminOpsFrame>
  )
}
