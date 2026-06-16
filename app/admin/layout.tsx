import OpsShell from "@/components/ops/shell"
import { resolveAdminPageRender } from "@/core/admin/render"

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const { header_session } = await resolveAdminPageRender()

  return <OpsShell session={header_session}>{children}</OpsShell>
}
