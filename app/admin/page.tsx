import AdminHome from "@/components/admin/home"
import { requireAdminAccess } from "@/core/admin/guard"

export default async function AdminPage() {
  const { session } = await requireAdminAccess()

  return <AdminHome session={session} />
}
