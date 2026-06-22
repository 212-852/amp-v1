import AdminOpsFrame from "@/components/admin/frame"
import NotificationPageView from "@/components/notification/page_view"
import { requireAdminAccess } from "@/core/admin/guard"
import { resolveAuthContext } from "@/core/auth/context"

export default async function AdminNotificationsPage() {
  const context = await resolveAuthContext("/admin/notifications")
  const { session } = await requireAdminAccess()

  return (
    <AdminOpsFrame pathname="/admin/notifications" session={session}>
      <NotificationPageView
        session={session}
        locale={context.locale ?? "ja"}
      />
    </AdminOpsFrame>
  )
}
