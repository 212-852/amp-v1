import { notFound } from "next/navigation"

import AdminConciergeRoom from "@/components/admin/concierge_room"
import AdminOpsFrame from "@/components/admin/frame"
import { resolveAuthContext } from "@/core/auth/context"
import { requireAdminAccess } from "@/core/admin/guard"
import { resolveAdminChatRoom } from "@/core/chat/action"
import { loadRoomParticipants, loadUserProfiles } from "@/core/chat/archive"
import {
  build_concierge_queue_room,
  resolve_customer_participant,
} from "@/core/concierge/message"

async function resolve_room_breadcrumb_name(
  participants: Awaited<ReturnType<typeof loadRoomParticipants>>,
  user_profiles: Awaited<ReturnType<typeof loadUserProfiles>>,
  state: NonNullable<Awaited<ReturnType<typeof resolveAdminChatRoom>>>,
) {
  const customer = resolve_customer_participant(participants)

  if (customer?.user_uuid) {
    const profile = user_profiles.get(customer.user_uuid)

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
  const participants = await loadRoomParticipants(state.room.room_uuid)
  const user_uuids = participants
    .map((participant) => participant.user_uuid)
    .filter((user_uuid): user_uuid is string => Boolean(user_uuid))
  const user_profiles = await loadUserProfiles(user_uuids)
  const customer_header = build_concierge_queue_room({
    room: state.room,
    participants,
    latest_message: state.messages.at(-1) ?? null,
    admin_active_count: state.presence.length,
    user_profiles,
  })

  return (
    <AdminOpsFrame
      pathname={resolved_room_path}
      session={session}
      breadcrumb_room_name={await resolve_room_breadcrumb_name(
        participants,
        user_profiles,
        state,
      )}
    >
      <AdminConciergeRoom
        state={state}
        viewer_display_name={session.display_name}
        customer_header={customer_header}
      />
    </AdminOpsFrame>
  )
}
