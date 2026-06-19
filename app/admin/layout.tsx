import { requireAdminAccess } from "@/core/admin/guard"
import { resolveAuthContext } from "@/core/auth/context"

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const context = await resolveAuthContext()
  await requireAdminAccess(context.requested_route ?? "/admin")

  return children
}
