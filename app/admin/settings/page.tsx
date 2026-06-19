import AdminComingSoon from "@/components/admin/coming-soon"
import AdminOpsFrame from "@/components/admin/frame"
import { requireAdminAccess } from "@/core/admin/guard"

export default async function AdminSettingsPage() {
  const { session } = await requireAdminAccess()

  return (
    <AdminOpsFrame pathname="/admin/settings" session={session}>
      <AdminComingSoon title="Settings" />
    </AdminOpsFrame>
  )
}
