import type { Session } from "@/core/auth/types"
import {
  loadConciergeQueueRooms,
  loadLatestRoomMessages,
  loadRoomParticipants,
  loadUserProfiles,
} from "@/core/chat/archive"
import { canToggleConciergeAvailability } from "@/core/chat/concierge_access"
import { loadOnlinePresenceViews } from "@/core/chat/presence"
import {
  build_concierge_message_preview,
  build_concierge_queue_room,
  resolve_assigned_staff_participant,
  resolve_customer_participant,
  type ConciergeQueueRoom,
} from "@/core/concierge/message"
import type {
  ChatMessageRecord,
  ChatParticipantRecord,
  ChatRoomRecord,
} from "@/core/chat/types"

export type ConciergeQueueItem = ConciergeQueueRoom

export function isConciergeActionRoom(room: Pick<ChatRoomRecord, "mode">) {
  return room.mode === "concierge"
}

export function resolveCustomerParticipant(
  participants: ChatParticipantRecord[],
) {
  return resolve_customer_participant(participants)
}

export function resolveAssignedStaffParticipant(
  participants: ChatParticipantRecord[],
) {
  return resolve_assigned_staff_participant(participants)
}

export function buildConciergeMessagePreview(
  message: ChatMessageRecord | null | undefined,
  room_locale: ChatRoomRecord["locale"],
) {
  return build_concierge_message_preview(message, room_locale)
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
  return build_concierge_queue_room(input)
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
