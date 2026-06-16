export default async function AdminPage() {
  const { renderAdminRestorePage } = await import("@/core/admin/restore")

  return renderAdminRestorePage()
}
