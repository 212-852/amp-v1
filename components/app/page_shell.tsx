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
    <div className="flex min-h-dvh flex-col bg-[#fdfaf6] text-[#3d2a19]">
      <AppHeader
        auth={auth}
        breadcrumb_items={breadcrumb_items}
        layout="page"
      />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-8">
        {children}
      </main>
      <AppSiteFooter />
    </div>
  )
}
