import {
  findParticipantByRole,
  findOwnerParticipantInRoom,
  findRoomByKey,
  insertParticipant,
  linkParticipantToUser,
  upsertParticipant,
} from "@/core/chat/archive"
import { resolve_room_key } from "@/core/chat/rules"
import type {
  ChatParticipantRecord,
  ChatParticipantRole,
  ChatRoomRecord,
} from "@/core/chat/types"
import { sendAuthDebug } from "@/core/debug"

export type ParticipantIdentity = {
  visitor_uuid: string | null
  user_uuid: string | null
  order_uuid?: string | null
}

export type ResolvedOwnerParticipant = {
  room: ChatRoomRecord
  participant: ChatParticipantRecord
  found_by: "user_uuid" | "visitor_uuid" | "room_key"
}

export async function resolveOwnedParticipant(
  input: ParticipantIdentity,
): Promise<ResolvedOwnerParticipant | null> {
  const room_key = resolve_room_key(input)
  const room = await findRoomByKey(room_key)

  if (!room) {
    return null
  }

  let participant = await findOwnerParticipantInRoom({
    room_uuid: room.room_uuid,
    user_uuid: input.user_uuid,
    visitor_uuid: input.visitor_uuid,
    role: input.user_uuid ? "user" : "guest",
  })

  if (!participant) {
    return null
  }

  if (
    input.user_uuid &&
    participant.visitor_uuid === input.visitor_uuid &&
    (!participant.user_uuid || participant.role === "guest")
  ) {
    try {
      participant = await linkParticipantToUser({
        participant_uuid: participant.participant_uuid,
        user_uuid: input.user_uuid,
      })
    } catch {
      participant =
        (await findOwnerParticipantInRoom({
          room_uuid: room.room_uuid,
          user_uuid: input.user_uuid,
          visitor_uuid: input.visitor_uuid,
          role: "user",
        })) ?? participant
    }
  }

  return {
    room,
    participant,
    found_by: input.user_uuid ? "user_uuid" : "visitor_uuid",
  }
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
  console.info("[chat_core] participant_upsert_entered", {
    room_uuid: input.room_uuid,
    role: input.role,
    user_uuid: input.user_uuid,
    visitor_uuid: input.visitor_uuid,
  })

  const existing = await findOwnerParticipantInRoom({
    room_uuid: input.room_uuid,
    user_uuid: input.user_uuid,
    visitor_uuid: input.visitor_uuid,
    role: input.role,
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

      await sendAuthDebug("participant_upserted", {
        room_uuid: linked.room_uuid,
        user_uuid: linked.user_uuid,
        visitor_uuid: linked.visitor_uuid,
        role: linked.role,
        created: false,
      })

      return {
        participant: linked,
        created: false,
      }
    }

    await sendAuthDebug("participant_upserted", {
      room_uuid: existing.room_uuid,
      user_uuid: existing.user_uuid,
      visitor_uuid: existing.visitor_uuid,
      role: existing.role,
      created: false,
    })

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

  await sendAuthDebug("participant_upserted", {
    room_uuid: participant.room_uuid,
    user_uuid: participant.user_uuid,
    visitor_uuid: participant.visitor_uuid,
    role: participant.role,
    created: true,
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

export async function ensureRoleParticipant(input: {
  room_uuid: string
  role: Extract<ChatParticipantRole, "bot" | "concierge">
}): Promise<ChatParticipantRecord> {
  const existing = await findParticipantByRole({
    room_uuid: input.room_uuid,
    role: input.role,
  })

  if (existing) {
    return existing
  }

  let participant: ChatParticipantRecord

  try {
    participant = await insertParticipant({
      room_uuid: input.room_uuid,
      role: input.role,
      visitor_uuid: null,
      user_uuid: null,
    })
  } catch {
    const recovered = await findParticipantByRole({
      room_uuid: input.room_uuid,
      role: input.role,
    })

    if (!recovered) {
      throw new Error(`Failed to ensure ${input.role} participant`)
    }

    return recovered
  }

  await sendAuthDebug("participant_created", {
    room_uuid: participant.room_uuid,
    participant_uuid: participant.participant_uuid,
    role: participant.role,
    visitor_uuid: participant.visitor_uuid,
    user_uuid: participant.user_uuid,
  })

  return participant
}
