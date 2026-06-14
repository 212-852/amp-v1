import AdminFooter from "@/components/admin/footer"
import AdminHeader from "@/components/admin/header"
import AdminAssistant from "@/components/admin/assistant"

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <div className="flex min-h-dvh flex-col bg-neutral-50 text-neutral-900">
      <AdminHeader />
      <main className="mx-auto flex w-full max-w-[430px] flex-1 flex-col gap-4 px-4 pb-[calc(112px+env(safe-area-inset-bottom,0px))] pt-4">
        {children}
      </main>
      <AdminFooter />
      <AdminAssistant
        latest_notification="Admin foundation is ready. Operational tools will be added later."
        status="notification"
      />
    </div>
  )
}
