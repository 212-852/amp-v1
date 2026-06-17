import {
  clearStaleTypingStates,
  findParticipant,
  findRoomForOwner,
  insertParticipant,
  insertRoom,
  loadConciergeAvailability,
  loadRoomMessages,
  loadTypingStates,
  updateRoomChannel,
} from "@/core/chat/archive"
import {
  resolveChatLocale,
  resolveParticipantDisplayName,
  resolveParticipantRole,
} from "@/core/chat/context"
import { bootstrapRoomWelcome } from "@/core/chat/message"
import type {
  ChatContext,
  ChatRoomBootstrapResult,
  ChatRoomState,
} from "@/core/chat/types"
import type { Session } from "@/core/auth/types"

function resolveRoomIdentity(context: ChatContext, session: Session) {
  const visitor_uuid = context.visitor_uuid ?? session.visitor_uuid
  const user_uuid = context.user_uuid ?? session.user_uuid

  if (!visitor_uuid && !user_uuid) {
    throw new Error("Chat requires visitor_uuid or user_uuid")
  }

  return { visitor_uuid, user_uuid }
}

export async function bootstrapChatRoom(
  context: ChatContext,
  session: Session,
): Promise<ChatRoomBootstrapResult> {
  const identity = resolveRoomIdentity(context, session)
  const locale = resolveChatLocale(context.locale, null)

  let room = await findRoomForOwner(identity)
  let room_created = false

  if (!room) {
    room = await insertRoom({
      mode: "bot",
      locale,
      channel: context.source_channel,
      owner_visitor_uuid: identity.user_uuid ? null : identity.visitor_uuid,
      owner_user_uuid: identity.user_uuid,
    })
    room_created = true
  } else {
    room = await updateRoomChannel({
      room_uuid: room.room_uuid,
      channel: context.source_channel,
      user_uuid: identity.user_uuid,
    })
  }

  const participant_role = resolveParticipantRole(session.role)
  let participant = await findParticipant({
    room_uuid: room.room_uuid,
    visitor_uuid: identity.visitor_uuid,
    user_uuid: identity.user_uuid,
  })
  let participant_created = false

  if (!participant) {
    participant = await insertParticipant({
      room_uuid: room.room_uuid,
      role: participant_role,
      visitor_uuid: identity.visitor_uuid,
      user_uuid: identity.user_uuid,
      display_name: resolveParticipantDisplayName(session, participant_role),
    })
    participant_created = true
  }

  if (room_created) {
    await bootstrapRoomWelcome({
      room,
      participant,
      session,
      source_channel: context.source_channel,
    })
  }

  return {
    room,
    participant,
    created: room_created,
    participant_created,
  }
}

export async function resolveOrCreateRoom(
  context: ChatContext,
  session: Session,
) {
  return bootstrapChatRoom(context, session)
}

export async function loadChatRoomState(
  context: ChatContext,
  session: Session,
): Promise<ChatRoomState> {
  const { room, participant } = await bootstrapChatRoom(context, session)
  const cutoff = new Date(Date.now() - 5000).toISOString()

  await clearStaleTypingStates(room.room_uuid, cutoff)

  const typing = (await loadTypingStates(room.room_uuid)).filter(
    (entry) =>
      entry.participant_uuid !== participant.participant_uuid &&
      entry.updated_at >= cutoff,
  )

  return {
    room,
    participant,
    messages: await loadRoomMessages(room.room_uuid),
    typing,
    concierge_available: await loadConciergeAvailability(),
  }
}
