import { notFound } from "next/navigation"

import AdminConciergeRoom from "@/components/admin/concierge_room"
import AdminShell from "@/components/admin/shell"
import { resolveAuthContext } from "@/core/auth/context"
import { resolveSession } from "@/core/auth/session"
import { resolveAdminChatRoom } from "@/core/chat/action"

export default async function AdminConciergeRoomPage({
  params,
}: Readonly<{
  params: Promise<{ room_uuid: string }>
}>) {
  const { room_uuid } = await params
  const context = await resolveAuthContext()
  const session = await resolveSession(context)
  const state = await resolveAdminChatRoom(room_uuid, session, {
    source_channel: context.source_channel,
    locale: context.locale,
  }).catch(() => null)

  if (!state) {
    notFound()
  }

  return (
    <AdminShell session={session} pathname="/admin/concierge">
      <AdminConciergeRoom
        state={state}
        viewer_display_name={session.display_name}
      />
    </AdminShell>
  )
}
