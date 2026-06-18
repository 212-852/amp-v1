import {
  findOwnerParticipantInRoom,
  findOldestParticipantByUserUuid,
  findOldestParticipantByVisitorUuid,
  findRoomByUuid,
  linkParticipantToUser,
  upsertParticipant,
} from "@/core/chat/archive"
import type {
  ChatParticipantRecord,
  ChatParticipantRole,
  ChatRoomRecord,
} from "@/core/chat/types"

export type ParticipantIdentity = {
  visitor_uuid: string | null
  user_uuid: string | null
}

export type ResolvedOwnerParticipant = {
  room: ChatRoomRecord
  participant: ChatParticipantRecord
  found_by: "user_uuid" | "visitor_uuid"
}

export async function resolveOwnedParticipant(
  input: ParticipantIdentity,
): Promise<ResolvedOwnerParticipant | null> {
  let participant: ChatParticipantRecord | null = null
  let found_by: ResolvedOwnerParticipant["found_by"] | null = null

  if (input.user_uuid) {
    participant = await findOldestParticipantByUserUuid(input.user_uuid)

    if (participant) {
      found_by = "user_uuid"
    }
  }

  if (!participant && input.visitor_uuid) {
    participant = await findOldestParticipantByVisitorUuid(input.visitor_uuid)

    if (participant) {
      found_by = "visitor_uuid"
    }

    if (participant && input.user_uuid) {
      try {
        participant = await linkParticipantToUser({
          participant_uuid: participant.participant_uuid,
          user_uuid: input.user_uuid,
        })
        found_by = "user_uuid"
      } catch {
        const linked = await findOldestParticipantByUserUuid(input.user_uuid)

        if (linked) {
          participant = linked
          found_by = "user_uuid"
        }
      }
    }
  }

  if (!participant || !found_by) {
    return null
  }

  const room = await findRoomByUuid(participant.room_uuid)

  if (!room) {
    return null
  }

  return { room, participant, found_by }
}

export async function upsertRoomParticipant(input: {
  room_uuid: string
  role: ChatParticipantRole
  visitor_uuid: string | null
  user_uuid: string | null
}): Promise<{
  participant: ChatParticipantRecord
  created: boolean
}> {
  const existing = await findOwnerParticipantInRoom({
    room_uuid: input.room_uuid,
    user_uuid: input.user_uuid,
    visitor_uuid: input.visitor_uuid,
  })

  if (existing) {
    if (
      input.user_uuid &&
      existing.visitor_uuid === input.visitor_uuid &&
      (!existing.user_uuid || existing.role === "guest")
    ) {
      const linked = await linkParticipantToUser({
        participant_uuid: existing.participant_uuid,
        user_uuid: input.user_uuid,
      })

      return {
        participant: linked,
        created: false,
      }
    }

    return {
      participant: existing,
      created: false,
    }
  }

  const participant = await upsertParticipant({
    room_uuid: input.room_uuid,
    role: input.role,
    visitor_uuid: input.visitor_uuid,
    user_uuid:
      input.role === "guest" && !input.user_uuid ? null : input.user_uuid,
  })

  return {
    participant,
    created: true,
  }
}

export async function ensureOwnerParticipant(input: {
  room_uuid: string
  role: ChatParticipantRole
  visitor_uuid: string | null
  user_uuid: string | null
}): Promise<ChatParticipantRecord> {
  const result = await upsertRoomParticipant(input)
  return result.participant
}