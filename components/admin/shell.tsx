import OpsAssistant from "@/components/ops/assistant"
import OpsHeader from "@/components/ops/header"
import {
  normalizeOpsHeaderSession,
  type HeaderSessionLike,
} from "@/core/ops/header_session"

export default function AdminShell({
  children,
  session,
}: Readonly<{
  children: React.ReactNode
  session?: HeaderSessionLike | null
}>) {
  const header_session = normalizeOpsHeaderSession(session, {
    default_display_name: "Admin",
    default_role: "admin",
  })

  return (
    <div className="min-h-dvh bg-neutral-50 text-neutral-900">
      <OpsHeader session={header_session} />
      <main className="mx-auto flex w-full max-w-[430px] flex-col gap-3 px-5 pb-[calc(118px+env(safe-area-inset-bottom,0px))] pt-4">
        {children}
      </main>
      <OpsAssistant />
    </div>
  )
}
