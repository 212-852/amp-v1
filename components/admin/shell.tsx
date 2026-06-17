import OpsAssistant from "@/components/ops/assistant"
import OpsHeader from "@/components/ops/header"
import { getConciergeAvailabilityState } from "@/core/chat/action"
import { resolvePageLabel } from "@/core/ops/page_label"
import {
  normalizeOpsHeaderSession,
  type HeaderSessionLike,
} from "@/core/ops/header_session"

export default async function AdminShell({
  children,
  session,
  pathname = "/admin",
}: Readonly<{
  children: React.ReactNode
  session?: HeaderSessionLike | null
  pathname?: string
}>) {
  const header_session = normalizeOpsHeaderSession(session, {
    default_display_name: "Admin",
    default_role: "admin",
  })
  const page_label = resolvePageLabel(pathname)
  const concierge_available = (await getConciergeAvailabilityState()).enabled

  return (
    <div className="min-h-dvh bg-neutral-50 text-neutral-900">
      <OpsHeader
        session={header_session}
        page_label={page_label}
        concierge_available={concierge_available}
      />
      <main className="mx-auto flex w-full max-w-[430px] flex-col gap-3 px-5 pb-[calc(118px+env(safe-area-inset-bottom,0px))] pt-4">
        {children}
      </main>
      <OpsAssistant />
    </div>
  )
}
