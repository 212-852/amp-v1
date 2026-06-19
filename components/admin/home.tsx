import AdminConciergeQueue from "@/components/admin/concierge_queue"
import AdminFooter from "@/components/admin/footer"
import AdminHeader from "@/components/admin/header"
import { resolveAdminHomeQueue } from "@/core/admin/queue"
import { getConciergeAvailabilityState } from "@/core/chat/action"
import { normalizeOpsHeaderDisplay } from "@/core/ops/header_session"
import { resolvePageLabel } from "@/core/ops/page_label"
import type { Session } from "@/core/auth/types"

export default async function AdminHome({
  session,
}: Readonly<{
  session: Session
}>) {
  const header_session = normalizeOpsHeaderDisplay(session)
  const queue = await resolveAdminHomeQueue(session)
  const concierge_available = await getConciergeAvailabilityState(session)
    .then((state) => state.enabled)
    .catch(() => false)

  return (
    <div className="min-h-dvh bg-neutral-50 text-neutral-900">
      <AdminHeader
        session={header_session}
        page_label={resolvePageLabel("/admin")}
        concierge_available={concierge_available}
      />
      <main className="mx-auto flex w-full max-w-[430px] flex-col gap-3 px-5 pb-[calc(118px+env(safe-area-inset-bottom,0px))] pt-[calc(92px+env(safe-area-inset-top,0px))]">
        <AdminConciergeQueue
          queue={queue}
          variant="preview"
          seeded_from_server
        />
      </main>
      <AdminFooter />
    </div>
  )
}
