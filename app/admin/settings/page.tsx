import AdminComingSoon from "@/components/admin/coming-soon"
import AdminShell from "@/components/admin/shell"
import { resolveAuthContext } from "@/core/auth/context"
import { resolveSession } from "@/core/auth/session"

export default async function AdminSettingsPage() {
  const context = await resolveAuthContext()
  const session = await resolveSession(context)

  return (
    <AdminShell session={session} pathname="/admin/settings">
      <AdminComingSoon title="Settings" />
    </AdminShell>
  )
}
