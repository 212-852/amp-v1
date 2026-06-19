import { requireAdminAccess } from "@/core/admin/guard"

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  await requireAdminAccess()

  return (
    <div className="min-h-dvh bg-neutral-50 text-neutral-900">{children}</div>
  )
}
