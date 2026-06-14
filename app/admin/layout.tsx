import AdminHeader from "@/components/admin/header"
import AdminAssistant from "@/components/admin/assistant"

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <div className="min-h-dvh bg-neutral-50 text-neutral-900">
      <AdminHeader />
      <main className="mx-auto flex w-full max-w-[430px] flex-col gap-5 px-5 pb-[calc(224px+env(safe-area-inset-bottom,0px))] pt-8">
        {children}
      </main>
      <AdminAssistant />
    </div>
  )
}
