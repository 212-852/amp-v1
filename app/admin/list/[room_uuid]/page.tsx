import { notFound } from "next/navigation"

import AdminConciergeRoom from "@/components/admin/concierge_room"
import AdminOpsFrame from "@/components/admin/frame"
import { resolveAuthContext } from "@/core/auth/context"
import { requireAdminAccess } from "@/core/admin/guard"
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

export default async function AdminListRoomPage({
  params,
}: Readonly<{
  params: Promise<{ room_uuid: string }>
}>) {
  const { room_uuid } = await params
  const room_path = `/admin/list/${room_uuid}`
  const { session } = await requireAdminAccess(room_path)
  const context = await resolveAuthContext(room_path)
  const state = await resolveAdminChatRoom(room_uuid, session, {
    source_channel: context.source_channel,
    locale: context.locale,
  }).catch(() => null)

  if (!state) {
    notFound()
  }

  const resolved_room_path = `/admin/list/${state.room.room_uuid}`

  return (
    <AdminOpsFrame
      pathname={resolved_room_path}
      session={session}
      breadcrumb_room_name={await resolve_room_breadcrumb_name(state)}
    >
      <AdminConciergeRoom
        state={state}
        viewer_display_name={session.display_name}
      />
    </AdminOpsFrame>
  )
}
