import AdminFooter from "@/components/admin/footer"
import AdminHeader from "@/components/admin/header"
import RoboNekoAssistant from "@/components/admin/robo-neko-assistant"

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <div className="min-h-dvh bg-[#f5f5f5] text-[#111111]">
      <AdminHeader />
      <main className="mx-auto w-full max-w-6xl px-4 pb-[calc(176px+env(safe-area-inset-bottom,0px))] pt-4 md:pb-24">
        {children}
      </main>
      <RoboNekoAssistant />
      <AdminFooter />
    </div>
  )
}
