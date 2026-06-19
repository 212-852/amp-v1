import { notFound } from "next/navigation"

import AdminConciergeRoom from "@/components/admin/concierge_room"
import AdminShell from "@/components/admin/shell"
import { resolveAuthContext } from "@/core/auth/context"
import { resolveSession } from "@/core/auth/session"
import { resolveAdminChatRoom } from "@/core/chat/action"
import { loadRoomParticipants, loadUserProfiles } from "@/core/chat/archive"
import { resolve_customer_participant } from "@/core/concierge/message"

async function resolve_room_breadcrumb_name(
  state: NonNullable<Awaited<ReturnType<typeof resolveAdminChatRoom>>>,
) {
  const participants = await loadRoomParticipants(state.room.room_uuid)
  const customer = resolve_customer_participant(participants)

  if (customer?.user_uuid) {
    const profiles = await loadUserProfiles([customer.user_uuid])
    const profile = profiles.get(customer.user_uuid)

    if (profile?.display_name?.trim()) {
      return profile.display_name.trim()
    }
  }

  return customer?.role === "guest" ? "Guest" : state.room.room_uuid
}

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
    <AdminShell
      session={session}
      pathname={`/admin/list/${state.room.room_uuid}`}
      breadcrumb_room_name={await resolve_room_breadcrumb_name(state)}
    >
      <AdminConciergeRoom
        state={state}
        viewer_display_name={session.display_name}
      />
    </AdminShell>
  )
}
