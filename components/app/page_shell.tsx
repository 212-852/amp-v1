import AppHeader, { type AppHeaderAuth } from "@/components/app/header"
import AppSiteFooter from "@/components/app/site_footer"
import type { BreadcrumbItem } from "@/core/breadcrumb/rules"

export default function AppPageShell({
  auth,
  breadcrumb_items = [],
  children,
}: Readonly<{
  auth: AppHeaderAuth
  breadcrumb_items?: BreadcrumbItem[]
  children: React.ReactNode
}>) {
  return (
    <div className="flex min-h-dvh flex-col bg-[#f5e8d5] text-[#3d2a19]">
      <AppHeader
        auth={auth}
        breadcrumb_items={breadcrumb_items}
        layout="page"
      />
      <main className="content_container flex w-full flex-1 flex-col px-4 py-4">
        {children}
      </main>
      <AppSiteFooter />
    </div>
  )
}
