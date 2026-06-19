import AdminComingSoon from "@/components/admin/coming-soon"
import AdminOpsFrame from "@/components/admin/frame"
import { requireAdminAccess } from "@/core/admin/guard"

export default async function AdminDriversPage() {
  const { session } = await requireAdminAccess()

  return (
    <AdminOpsFrame pathname="/admin/drivers" session={session}>
      <AdminComingSoon title="Drivers" />
    </AdminOpsFrame>
  )
}
