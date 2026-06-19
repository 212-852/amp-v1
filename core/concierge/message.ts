import { resolveMessageBodyDisplay } from "@/core/chat/rules"
import { resolve_concierge_room_href } from "@/core/concierge/rules"
import type {
  ChatMessageRecord,
  ChatParticipantRecord,
  ChatRoomRecord,
} from "@/core/chat/types"

export type ConciergeQueueRoom = {
  room_uuid: string
  href: string
  display_name: string
  avatar_url: string | null
  latest_message: string
  is_typing: boolean
  admin_active_count: number
  updated_at: string
  customer_participant_uuid: string
  customer_name: string
  customer_avatar_url: string | null
  latest_message_preview: string
  assigned_admin_name: string | null
}

const PREVIEW_MAX_LENGTH = 72

export function resolve_customer_participant(
  participants: ChatParticipantRecord[],
) {
  return (
    participants.find((participant) => participant.role === "user") ??
    participants.find((participant) => participant.role === "guest") ??
    null
  )
}

export function resolve_assigned_staff_participant(
  participants: ChatParticipantRecord[],
) {
  return (
    participants.find((participant) => participant.role === "admin") ??
    participants.find((participant) => participant.role === "concierge") ??
    null
  )
}

export function build_concierge_message_preview(
  message: ChatMessageRecord | null | undefined,
  room_locale: ChatRoomRecord["locale"],
) {
  if (!message || message.type === "typing") {
    return ""
  }

  const body = resolveMessageBodyDisplay(message, room_locale).trim()

  if (!body) {
    return ""
  }

  if (body.length <= PREVIEW_MAX_LENGTH) {
    return body
  }

  return `${body.slice(0, PREVIEW_MAX_LENGTH)}...`
}

export function build_concierge_queue_room(input: {
  room: ChatRoomRecord
  participants: ChatParticipantRecord[]
  latest_message: ChatMessageRecord | null
  admin_active_count: number
  user_profiles: Map<
    string,
    { display_name: string | null; image_url: string | null }
  >
}) {
  const customer = resolve_customer_participant(input.participants)

  if (!customer) {
    return null
  }

  const assigned = resolve_assigned_staff_participant(input.participants)
  const customer_profile = customer.user_uuid
    ? input.user_profiles.get(customer.user_uuid)
    : null
  const assigned_profile = assigned?.user_uuid
    ? input.user_profiles.get(assigned.user_uuid)
    : null
  const display_name =
    customer_profile?.display_name?.trim() ||
    (customer.role === "guest" ? "Guest" : "Customer")
  const avatar_url = customer_profile?.image_url ?? null
  const latest_message = build_concierge_message_preview(
    input.latest_message,
    input.room.locale,
  )

  return {
    room_uuid: input.room.room_uuid,
    href: resolve_concierge_room_href(input.room.room_uuid),
    display_name,
    avatar_url,
    latest_message,
    is_typing: false,
    admin_active_count: input.admin_active_count,
    customer_participant_uuid: customer.participant_uuid,
    customer_name: display_name,
    customer_avatar_url: avatar_url,
    latest_message_preview: latest_message,
    assigned_admin_name: assigned_profile?.display_name?.trim() ?? null,
    updated_at: input.latest_message?.created_at ?? input.room.updated_at,
  } satisfies ConciergeQueueRoom
}
