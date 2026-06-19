import type { Session } from "@/core/auth/types"
import {
  loadConciergeQueueRooms,
  loadLatestRoomMessages,
  loadRoomParticipants,
  loadUserProfiles,
} from "@/core/chat/archive"
import { canToggleConciergeAvailability } from "@/core/chat/concierge_access"
import { loadOnlinePresenceViews } from "@/core/chat/presence"
import { resolveMessageBodyDisplay } from "@/core/chat/rules"
import type {
  ChatMessageRecord,
  ChatParticipantRecord,
  ChatRoomRecord,
} from "@/core/chat/types"

export type ConciergeQueueItem = {
  room_uuid: string
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

export function isConciergeActionRoom(room: Pick<ChatRoomRecord, "mode">) {
  return room.mode === "concierge"
}

export function resolveCustomerParticipant(
  participants: ChatParticipantRecord[],
) {
  return (
    participants.find((participant) => participant.role === "user") ??
    participants.find((participant) => participant.role === "guest") ??
    null
  )
}

export function resolveAssignedStaffParticipant(
  participants: ChatParticipantRecord[],
) {
  return (
    participants.find((participant) => participant.role === "admin") ??
    participants.find((participant) => participant.role === "concierge") ??
    null
  )
}

export function buildConciergeMessagePreview(
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

export function buildConciergeQueueItem(input: {
  room: ChatRoomRecord
  participants: ChatParticipantRecord[]
  latest_message: ChatMessageRecord | null
  admin_active_count: number
  user_profiles: Map<
    string,
    { display_name: string | null; image_url: string | null }
  >
}) {
  const customer = resolveCustomerParticipant(input.participants)

  if (!customer) {
    return null
  }

  const assigned = resolveAssignedStaffParticipant(input.participants)
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
  const latest_message = buildConciergeMessagePreview(
    input.latest_message,
    input.room.locale,
  )

  return {
    room_uuid: input.room.room_uuid,
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
    updated_at: input.room.updated_at,
  } satisfies ConciergeQueueItem
}

export async function loadConciergeQueue(
  session: Session,
  options?: { limit?: number; mode?: "concierge" },
) {
  if (!canToggleConciergeAvailability(session)) {
    throw new Error("Concierge queue access denied")
  }

  const limit = options?.limit ?? 10
  const rooms = await loadConciergeQueueRooms(limit, {
    mode: options?.mode ?? "concierge",
  })

  if (rooms.length === 0) {
    return []
  }

  const room_uuids = rooms.map((room) => room.room_uuid)
  const [participants_by_room, latest_messages, presence_by_room] = await Promise.all([
    Promise.all(
      room_uuids.map(async (room_uuid) => ({
        room_uuid,
        participants: await loadRoomParticipants(room_uuid),
      })),
    ),
    loadLatestRoomMessages(room_uuids),
    Promise.all(
      room_uuids.map(async (room_uuid) => ({
        room_uuid,
        presence: await loadOnlinePresenceViews(room_uuid),
      })),
    ),
  ])

  const user_uuids = new Set<string>()

  for (const entry of participants_by_room) {
    for (const participant of entry.participants) {
      if (participant.user_uuid) {
        user_uuids.add(participant.user_uuid)
      }
    }
  }

  const user_profiles = await loadUserProfiles([...user_uuids])
  const participants_map = new Map(
    participants_by_room.map((entry) => [entry.room_uuid, entry.participants]),
  )
  const presence_map = new Map(
    presence_by_room.map((entry) => [entry.room_uuid, entry.presence]),
  )

  const items: ConciergeQueueItem[] = []

  for (const room of rooms) {
    const participants = participants_map.get(room.room_uuid) ?? []
    const presence = presence_map.get(room.room_uuid) ?? []
    const item = buildConciergeQueueItem({
      room,
      participants,
      latest_message: latest_messages.get(room.room_uuid) ?? null,
      admin_active_count: presence.filter((entry) => {
        const participant = participants.find(
          (candidate) =>
            candidate.participant_uuid === entry.participant_uuid,
        )

        return (
          (participant?.role === "admin" ||
            participant?.role === "concierge") &&
          participant.user_uuid !== session.user_uuid
        )
      }).length,
      user_profiles,
    })

    if (item) {
      items.push(item)
    }
  }

  return items
}
