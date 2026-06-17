import {
  findParticipant,
  findRoomByUuid,
  insertParticipant,
  loadConciergeAvailability,
  loadRoomMessages,
} from "@/core/chat/archive"
import {
  resolveChatLocale,
  resolveParticipantRole,
} from "@/core/chat/context"
import { bootstrapRoomWelcome } from "@/core/chat/message"
import { loadOnlinePresenceViews } from "@/core/chat/presence"
import { resolveOwnedRoom } from "@/core/chat/rules"
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

function resolveOwnerParticipantRole(
  session: Session,
  user_uuid: string | null,
): "guest" | "user" {
  if (user_uuid && session.role === "user") {
    return "user"
  }

  if (user_uuid) {
    return "user"
  }

  return "guest"
}

export async function bootstrapChatRoom(
  context: ChatContext,
  session: Session,
): Promise<ChatRoomBootstrapResult> {
  const identity = resolveRoomIdentity(context, session)
  const locale = resolveChatLocale(context.locale, null)
  const owner_role = resolveOwnerParticipantRole(session, identity.user_uuid)

  const resolved = await resolveOwnedRoom({
    identity,
    locale,
    channel: context.source_channel,
    owner_role,
  })

  await bootstrapRoomWelcome({
    room: resolved.room,
    participant: resolved.participant,
    session,
    source_channel: context.source_channel,
  })

  return {
    room: resolved.room,
    participant: resolved.participant,
    created: resolved.created,
    participant_created: resolved.participant_created,
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

  return {
    room,
    participant,
    messages: await loadRoomMessages(room.room_uuid),
    presence: await loadOnlinePresenceViews(room.room_uuid),
    concierge_available: await loadConciergeAvailability(),
  }
}

export async function loadChatRoomStateByUuid(
  room_uuid: string,
  session: Session,
  source_channel: Session["source_channel"],
  locale?: string | null,
): Promise<ChatRoomState | null> {
  const room = await findRoomByUuid(room_uuid)

  if (!room) {
    return null
  }

  const identity = resolveRoomIdentity(
    {
      source_channel,
      locale: resolveChatLocale(locale, room.locale),
      visitor_uuid: session.visitor_uuid,
      user_uuid: session.user_uuid,
      session_role: session.role,
      display_name: session.display_name,
      participant_uuid: null,
      room_uuid,
    },
    session,
  )

  let participant = await findParticipant({
    room_uuid: room.room_uuid,
    visitor_uuid: identity.visitor_uuid,
    user_uuid: identity.user_uuid,
  })

  if (!participant) {
    const participant_role = resolveParticipantRole(session.role)
    participant = await insertParticipant({
      room_uuid: room.room_uuid,
      role: participant_role,
      visitor_uuid: identity.visitor_uuid,
      user_uuid: identity.user_uuid,
    })
  }

  return {
    room,
    participant,
    messages: await loadRoomMessages(room.room_uuid),
    presence: await loadOnlinePresenceViews(room.room_uuid),
    concierge_available: await loadConciergeAvailability(),
  }
}
