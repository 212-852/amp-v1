import AdminComingSoon from "@/components/admin/coming-soon"
import AdminOpsFrame from "@/components/admin/frame"
import { requireAdminAccess } from "@/core/admin/guard"

export default async function AdminUsersPage() {
  const { session } = await requireAdminAccess()

  return (
    <AdminOpsFrame pathname="/admin/users" session={session}>
      <AdminComingSoon title="Users" />
    </AdminOpsFrame>
  )
}
