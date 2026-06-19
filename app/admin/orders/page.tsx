import AdminComingSoon from "@/components/admin/coming-soon"
import AdminOpsFrame from "@/components/admin/frame"
import { requireAdminAccess } from "@/core/admin/guard"

export default async function AdminOrdersPage() {
  const { session } = await requireAdminAccess()

  return (
    <AdminOpsFrame pathname="/admin/orders" session={session}>
      <AdminComingSoon title="Orders" />
    </AdminOpsFrame>
  )
}
