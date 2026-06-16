import { renderAdminIsolationPage } from "@/core/admin/isolation"

// Enable with ADMIN_ISOLATION_STAGE=1..5
// Rename to page.tsx when bisecting past stage 0.
export default async function AdminPage() {
  return renderAdminIsolationPage()
}
